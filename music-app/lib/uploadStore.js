// /lib/uploadStore.js
import { create } from 'zustand';

export const useUploadStore = create((set) => ({
  uploads: {}, // { uploadId: { progress, stage } }

  addUpload: (uploadId) =>
    set((state) => {
      console.log('🎯 Adding upload to store:', uploadId);
      return {
        uploads: { ...state.uploads, [uploadId]: { progress: 0, stage: 'starting' } },
      };
    }),

  updateUpload: (uploadId, data) =>
    set((state) => {
      console.log('🔄 Updating upload in store:', uploadId, data);
      return {
        uploads: { ...state.uploads, [uploadId]: { ...state.uploads[uploadId], ...data } },
      };
    }),

  removeUpload: (uploadId) =>
    set((state) => {
      const newUploads = { ...state.uploads };
      delete newUploads[uploadId];
      return { uploads: newUploads };
    }),
}));
