'use client'

import { useState } from 'react'
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
  YouTube as YouTubeIcon 
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import { forwardRef } from 'react'

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-api-domain.com' 
  : 'http://localhost:8000'

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />
})

export default function AddSongModal({ isOpen, onClose, onSongAdded }) {
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    if (!youtubeUrl.includes('youtube.com') && !youtubeUrl.includes('youtu.be')) {
      setError('Please enter a valid YouTube URL')
      return
    }

    setIsLoading(true)

    try {
      const response = await axios.post(`${API_BASE}/api/download-and-upload`, {
        youtubeUrl: youtubeUrl.trim(),
        fileName: fileName.trim()
      })

      const newSong = {
        id: response.data.fileId,
        name: response.data.fileName,
        videoTitle: response.data.videoTitle,
        createdTime: new Date().toISOString()
      }

      onSongAdded(newSong)
      
      setYoutubeUrl('')
      setFileName('')
      setError('')
      onClose()
      
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
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setYoutubeUrl('')
      setFileName('')
      setError('')
      onClose()
    }
  }

  return (
    <Dialog
      open={isOpen}
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
                Import music from YouTube
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
                  Downloading from YouTube and uploading to Google Drive. This may take a moment.
                </Typography>
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