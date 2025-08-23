// /hooks/useUploadProgress.js
import { useEffect } from 'react';
import { useUploadStore } from '../lib/uploadStore';
import { API_BASE } from '../lib/config';

export default function useUploadProgress(uploadId) {
  const { updateUpload, removeUpload } = useUploadStore();

  useEffect(() => {
    if (!uploadId) return;

    let cancelled = false;
    const controller = new AbortController();
    const evtSource = new EventSource(`${API_BASE}/api/progress/${uploadId}`);

    evtSource.onmessage = (e) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(e.data);
        updateUpload(uploadId, data);
        if (data.stage === 'done' || data.stage === 'error') {
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
  }, [uploadId, updateUpload, removeUpload]);
}
