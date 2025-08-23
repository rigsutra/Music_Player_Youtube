// /lib/uploadStore.js
import { create } from 'zustand';

export const useUploadStore = create((set) => ({
  uploads: {}, // { uploadId: { progress, stage } }

  addUpload: (uploadId) =>
    set((state) => ({
      uploads: { ...state.uploads, [uploadId]: { progress: 0, stage: 'starting' } },
    })),

  updateUpload: (uploadId, data) =>
    set((state) => ({
      uploads: { ...state.uploads, [uploadId]: { ...state.uploads[uploadId], ...data } },
    })),

  removeUpload: (uploadId) =>
    set((state) => {
      const newUploads = { ...state.uploads };
      delete newUploads[uploadId];
      return { uploads: newUploads };
    }),
}));
