'use client'

import { useState, useEffect, forwardRef } from 'react'
import { 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Alert,
  Slide,
  Paper
} from '@mui/material'
import { 
  Close as CloseIcon, 
  CloudUpload as CloudUploadIcon,
  YouTube as YouTubeIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import apiClient from '../lib/api'
import { YOUTUBE_URL_REGEX, sanitizeFileName } from '../lib/config'
import { useUploadStore } from '../lib/uploadStore'

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />
})

export default function AddSongModal({ isOpen, onClose, onSongAdded, fetchSongsFromDrive }) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isHidden, setIsHidden] = useState(false)
  const { addUpload } = useUploadStore()

  useEffect(() => {
    if (isOpen) setIsHidden(false)
  }, [isOpen])

  const handleHide = () => {
    setIsHidden(true)
    onClose()

    toast.loading('Upload running in background… Click to reopen.', {
      duration: Infinity,
      id: 'upload-toast',
      style: {
        background: '#1f2937',
        color: '#fff',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        cursor: 'pointer'
      },
      onClick: () => {
        window.dispatchEvent(new CustomEvent('open-add-song'))
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL')
      return
    }
    if (!YOUTUBE_URL_REGEX.test(youtubeUrl.trim())) {
      setError('Invalid YouTube URL')
      return
    }
    
    setIsLoading(true)

    try {
      const response = await apiClient.post('/api/upload/start', {
        youtubeUrl: youtubeUrl.trim(),
        fileName: sanitizeFileName(fileName.trim())
      })
      
      const { fileId, fileName: srvFileName, videoTitle, uploadId } = response.data || {}
      const optimisticId = fileId || uploadId || `temp-${Date.now()}`
      const provisionalName = srvFileName || (fileName.trim() ? sanitizeFileName(fileName.trim()) + '.webm' : (videoTitle ? sanitizeFileName(videoTitle) + '.webm' : 'Processing.webm'))

      const newSong = {
        id: optimisticId,
        uploadId: uploadId || null,
        name: provisionalName,
        videoTitle: videoTitle || 'Processing…',
        size: null,
        stage: uploadId ? 'uploading' : 'starting',
        createdTime: new Date().toISOString(),
        liked: false,
        isOptimistic: true
      }

      // Add to upload store for tracking
      if (uploadId) {
        addUpload(uploadId)
      }

      onSongAdded(newSong)
      toast.success('Upload started! Track progress below.', { duration: 3000 })

      if (!isHidden) {
        setYoutubeUrl('')
        setFileName('')
        onClose()
      }

    } catch (error) {
      console.error('Error adding song:', error)
      
      if (error.response?.status === 401) {
        setError('Authentication required. Please refresh the page.')
      } else if (error.response?.status === 400) {
        setError(error.response.data.message || 'Invalid YouTube URL')
      } else {
        setError(error.response?.data?.message || 'Failed to add song. Please try again.')
      }
    } finally {
      setIsLoading(false)
      toast.dismiss('upload-toast')
      
      if (isHidden) {
        setIsHidden(false)
        setYoutubeUrl('')
        setFileName('')
        onClose()
      }
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setYoutubeUrl('')
      setFileName('')
      setError('')
      setIsHidden(false)
      toast.dismiss('upload-toast')
      onClose()
    }
  }

  return (
    <Dialog
      open={isOpen && !isHidden}
      onClose={handleClose}
      TransitionComponent={Transition}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(17, 24, 39, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 3,
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 48,
                height: 48,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 25px rgba(139, 92, 246, 0.3)',
              }}
            >
              <CloudUploadIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Add New Song
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Import to your personal library
              </Typography>
            </Box>
          </Box>
          
          {!isLoading && (
            <IconButton 
              onClick={handleClose}
              sx={{ 
                color: 'text.secondary',
                '&:hover': { backgroundColor: 'rgba(75, 85, 99, 0.1)' }
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2 }}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 3, borderRadius: 2 }}
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="YouTube URL"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            disabled={isLoading}
            required
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <YouTubeIcon sx={{ color: '#FF0000', mr: 1 }} />
              ),
            }}
          />

          <TextField
            fullWidth
            label="Custom Name (Optional)"
            placeholder="Leave empty to use video title"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            disabled={isLoading}
            helperText="If not specified, the video title will be used"
          />

          {isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Paper 
                sx={{ 
                  mt: 3, 
                  p: 3, 
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="center" gap={2} mb={2}>
                  <CircularProgress size={24} thickness={4} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Processing Your Song...
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Downloading from YouTube and uploading to your Google Drive. This may take a moment.
                </Typography>

                <Button 
                  startIcon={<ExpandMoreIcon />}
                  onClick={handleHide}
                  sx={{ mt: 2 }}
                >
                  Hide & Run in Background
                </Button>
              </Paper>
            </motion.div>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={handleClose}
            disabled={isLoading}
            sx={{ borderRadius: 2, minWidth: 100 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || !youtubeUrl.trim()}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <CloudUploadIcon />}
            sx={{ 
              borderRadius: 2, 
              minWidth: 140,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
              },
            }}
          >
            {isLoading ? 'Processing...' : 'Add Song'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
