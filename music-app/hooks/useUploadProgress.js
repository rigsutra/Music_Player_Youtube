// /hooks/useUploadProgress.js - MINIMAL FIX
import { useEffect } from 'react';
import { useUploadStore } from '../lib/uploadStore';
import { API_BASE } from '../lib/config';

export default function useUploadProgress(uploadId, onComplete) {
  const { updateUpload, removeUpload } = useUploadStore();

  useEffect(() => {
    if (!uploadId) return;

    // Get token from localStorage
    const token = localStorage.getItem('music_app_token');
    if (!token) {
      console.error('No auth token found for SSE');
      return;
    }

    // Pass token as query parameter for EventSource
    const sseUrl = `${API_BASE}/api/upload/progress/${uploadId}/stream?token=${encodeURIComponent(token)}`;
    
    console.log('📡 Starting SSE for upload:', uploadId);
    const evtSource = new EventSource(sseUrl);

    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('📊 SSE Progress:', uploadId, data);
        
        // Update the store
        updateUpload(uploadId, data);
        
        if (data.stage === 'done') {
          console.log('✅ Upload completed:', uploadId);
          
          if (onComplete) {
            onComplete(uploadId, data);
          }

          // Dispatch event for the main page to refresh songs
          window.dispatchEvent(new CustomEvent('upload-complete', {
            detail: { 
              uploadId, 
              success: true, 
              googleFileId: data.googleFileId, 
              videoTitle: data.videoTitle 
            }
          }));

          evtSource.close();
          // Keep status visible for a bit
          setTimeout(() => removeUpload(uploadId), 5000);
          
        } else if (data.stage === 'error' || data.stage === 'canceled') {
          console.log('❌ Upload failed/canceled:', uploadId);
          
          if (onComplete) {
            onComplete(uploadId, data);
          }

          // Dispatch failure event
          window.dispatchEvent(new CustomEvent('upload-complete', {
            detail: { 
              uploadId, 
              success: false, 
              error: data.error || 'Upload failed' 
            }
          }));

          evtSource.close();
          // Keep error visible longer
          setTimeout(() => removeUpload(uploadId), 10000);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    evtSource.onerror = (error) => {
      console.error('SSE error:', error);
      evtSource.close();
    };

    // Cleanup
    return () => {
      evtSource.close();
    };
  }, [uploadId, updateUpload, removeUpload, onComplete]);
}