// /components/UploadProgressManager.js - Centralized progress tracking
'use client'

import { useEffect } from 'react'
import { useUploadStore } from '../lib/uploadStore'
import useUploadProgress from '../hooks/useUploadProgress'


export default function UploadProgressManager() {
  const { uploads } = useUploadStore()
  const uploadIds = Object.keys(uploads)

  return (
    <>
      {uploadIds.map(uploadId => (
        <UploadProgressTracker 
          key={uploadId} 
          uploadId={uploadId} 
        />
      ))}
    </>
  )
}

// Individual tracker component - one per upload
function UploadProgressTracker({ uploadId }) {
  // This creates exactly ONE SSE connection per upload
  useUploadProgress(uploadId, (id, data) => {
    console.log('Upload completed:', id, data)
  })

  // This component renders nothing - it just manages the SSE connection
  return null
}