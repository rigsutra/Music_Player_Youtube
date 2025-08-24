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
        updateUpload(uploadId, data);
        
        if (data.stage === 'done') {
          // Notify that upload is complete
          if (onComplete) {
            onComplete(uploadId, data);
          }
          // Dispatch a global event for song list refresh
          window.dispatchEvent(new CustomEvent('upload-complete', { 
            detail: { uploadId, data } 
          }));
          evtSource.close();
          setTimeout(() => removeUpload(uploadId), 5000);
        } else if (data.stage === 'error') {
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
