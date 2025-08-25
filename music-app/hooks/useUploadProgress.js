// /hooks/useUploadProgress.js
import { useEffect } from 'react';
import { useUploadStore } from '../lib/uploadStore';
import { API_BASE } from '../lib/config';

export default function useUploadProgress(uploadId, onComplete) {
  const { updateUpload, removeUpload } = useUploadStore();

  useEffect(() => {
    if (!uploadId) return;

    let cancelled = false;
    const controller = new AbortController();
    const evtSource = new EventSource(`${API_BASE}/api/upload/progress/${uploadId}/stream`);

    evtSource.onmessage = (e) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(e.data);
        console.log('📡 SSE message received:', uploadId, data);
        updateUpload(uploadId, data);
        
        if (data.stage === 'done') {
          // Notify that upload is complete
          if (onComplete) {
            onComplete(uploadId, data);
          }

          // Dispatch a global event for song list refresh with a normalized payload
          // Include googleFileId and videoTitle when available so the UI can immediately
          // reconcile optimistic entries even if Drive hasn't listed the file yet.
          console.log('🎉 Dispatching upload-complete (success):', uploadId, data);
          window.dispatchEvent(new CustomEvent('upload-complete', {
            detail: { uploadId, success: true, googleFileId: data.googleFileId, videoTitle: data.videoTitle }
          }));

          evtSource.close();
          setTimeout(() => removeUpload(uploadId), 5000);
        } else if (data.stage === 'error') {
          // Notify completion handler of failure
          if (onComplete) {
            onComplete(uploadId, data);
          }

          // Dispatch normalized failure event
          window.dispatchEvent(new CustomEvent('upload-complete', {
            detail: { uploadId, success: false, error: data.error || 'error' }
          }));

          evtSource.close();
          setTimeout(() => removeUpload(uploadId), 5000);
        }
      } catch {}
    };

    evtSource.onerror = () => {
      if (!cancelled) {
        evtSource.close();
      }
    };

    return () => {
      cancelled = true;
      controller.abort();
      evtSource.close();
    };
  }, [uploadId, updateUpload, removeUpload, onComplete]);
}
