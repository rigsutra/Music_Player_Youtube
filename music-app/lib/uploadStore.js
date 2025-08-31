// /lib/uploadStore.js
import { create } from 'zustand';

export const useUploadStore = create((set) => ({
  uploads: {}, // { uploadId: { progress, stage, videoTitle, fileName, googleFileId, error } }

  addUpload: (uploadId, initialData = {}) =>
    set((state) => {
      return {
        uploads: { 
          ...state.uploads, 
          [uploadId]: { 
            progress: 0, 
            stage: 'starting',
            ...initialData
          } 
        },
      };
    }),

  updateUpload: (uploadId, data) =>
    set((state) => {
      return {
        uploads: { 
          ...state.uploads, 
          [uploadId]: { 
            ...state.uploads[uploadId], 
            ...data 
          } 
        },
      };
    }),

  removeUpload: (uploadId) =>
    set((state) => {
      const newUploads = { ...state.uploads };
      delete newUploads[uploadId];
      return { uploads: newUploads };
    }),

  // Helper to get upload by id
  getUpload: (uploadId) => (state) => state.uploads[uploadId],
}));
