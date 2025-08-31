// /components/UploadProgress.js - Progress display component
'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  IconButton,
  Chip,
  Fade,
  Collapse,
  Button
} from '@mui/material'
import {
  CloudUpload as CloudUploadIcon,
  CloudDone as CloudDoneIcon,
  Error as ErrorIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  YouTube as YouTubeIcon,
  CloudDownload as DownloadIcon,
  Close as CloseIcon
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useUploadStore } from '../lib/uploadStore'
import useUploadProgress from '../hooks/useUploadProgress'
import apiClient from '../lib/api'
import toast from 'react-hot-toast'

const getStageIcon = (stage) => {
  switch (stage) {
    case 'starting':
    case 'downloading':
      return <DownloadIcon sx={{ fontSize: 20 }} />
    case 'uploading':
      return <CloudUploadIcon sx={{ fontSize: 20 }} />
    case 'done':
      return <CloudDoneIcon sx={{ fontSize: 20, color: 'success.main' }} />
    case 'error':
      return <ErrorIcon sx={{ fontSize: 20, color: 'error.main' }} />
    case 'canceled':
      return <CancelIcon sx={{ fontSize: 20, color: 'warning.main' }} />
    default:
      return <CloudUploadIcon sx={{ fontSize: 20 }} />
  }
}

const getStageColor = (stage) => {
  switch (stage) {
    case 'done':
      return 'success'
    case 'error':
      return 'error'
    case 'canceled':
      return 'warning'
    default:
      return 'primary'
  }
}

const getStageLabel = (stage) => {
  switch (stage) {
    case 'starting':
      return 'Starting...'
    case 'downloading':
      return 'Downloading from YouTube'
    case 'uploading':
      return 'Uploading to Google Drive'
    case 'done':
      return 'Completed'
    case 'error':
      return 'Failed'
    case 'canceled':
      return 'Canceled'
    default:
      return 'Processing...'
  }
}

function UploadProgressItem({ uploadId, upload, onRetry, onCancel, onRemove }) {
  const [expanded, setExpanded] = useState(false)

  // REMOVED: Don't call useUploadProgress here - it's handled centrally
  // This was causing duplicate SSE connections

  const handleRetry = async () => {
    try {
      await apiClient.post(`/api/upload/retry/${uploadId}`)
      toast.success('Upload retrying...')
    } catch (error) {
      toast.error('Failed to retry upload')
    }
  }

  const handleCancel = async () => {
    try {
      await apiClient.post(`/api/upload/cancel/${uploadId}`)
      toast.success('Upload canceled')
      if (onCancel) onCancel(uploadId)
    } catch (error) {
      toast.error('Failed to cancel upload')
    }
  }

  const handleRemove = () => {
    if (onRemove) onRemove(uploadId)
  }

  const progress = upload.progress || 0
  const stage = upload.stage || 'starting'
  const error = upload.error

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        sx={{
          mb: 2,
          background: 'rgba(31, 41, 55, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: 2 }}>
          {/* Header Row */}
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Box
              sx={{
                width: 40,
                height: 40,
                background: stage === 'done' 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : stage === 'error'
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
              }}
            >
              {getStageIcon(stage)}
            </Box>

            <Box flex={1} minWidth={0}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap>
                {upload.videoTitle || upload.fileName || 'Processing...'}
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                <Chip
                  size="small"
                  label={getStageLabel(stage)}
                  color={getStageColor(stage)}
                  variant="outlined"
                  sx={{ fontSize: '0.75rem', height: 20 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {progress}%
                </Typography>
              </Box>
            </Box>

            {/* Action Buttons */}
            <Box display="flex" alignItems="center" gap={1}>
              {stage === 'error' && (
                <IconButton
                  size="small"
                  onClick={handleRetry}
                  sx={{ 
                    color: 'primary.main',
                    '&:hover': { backgroundColor: 'rgba(139, 92, 246, 0.1)' }
                  }}
                  title="Retry upload"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              )}
              
              {['starting', 'downloading', 'uploading'].includes(stage) && (
                <IconButton
                  size="small"
                  onClick={handleCancel}
                  sx={{ 
                    color: 'warning.main',
                    '&:hover': { backgroundColor: 'rgba(245, 158, 11, 0.1)' }
                  }}
                  title="Cancel upload"
                >
                  <CancelIcon fontSize="small" />
                </IconButton>
              )}

              {['done', 'error', 'canceled'].includes(stage) && (
                <IconButton
                  size="small"
                  onClick={handleRemove}
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: 'error.main'
                    }
                  }}
                  title="Remove from list"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}

              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                sx={{ 
                  color: 'text.secondary',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
                title={expanded ? "Collapse details" : "Expand details"}
              >
                <ExpandMoreIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Progress Bar */}
          {['starting', 'downloading', 'uploading'].includes(stage) && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(75, 85, 99, 0.3)',
                  '& .MuiLinearProgress-bar': {
                    background: stage === 'downloading'
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          )}

          {/* Expanded Details */}
          <Collapse in={expanded}>
            <Box 
              sx={{ 
                pt: 2, 
                borderTop: '1px solid rgba(75, 85, 99, 0.3)',
                fontSize: '0.875rem'
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <YouTubeIcon sx={{ fontSize: 16, color: '#FF0000' }} />
                <Typography variant="caption" color="text.secondary">
                  Upload ID: {uploadId.slice(0, 8)}...
                </Typography>
              </Box>
              
              {upload.fileName && (
                <Typography variant="caption" color="text.secondary" display="block">
                  File: {upload.fileName}
                </Typography>
              )}
              
              {error && (
                <Typography 
                  variant="caption" 
                  color="error.main" 
                  display="block"
                  sx={{ mt: 1, p: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 1 }}
                >
                  Error: {error}
                </Typography>
              )}
              
              {upload.retryCount > 0 && (
                <Typography variant="caption" color="warning.main" display="block">
                  Retry attempt: {upload.retryCount}
                </Typography>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function UploadProgress() {
  const { uploads, removeUpload } = useUploadStore()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  const uploadIds = Object.keys(uploads)
  const hasUploads = uploadIds.length > 0

  // Auto-expand when new uploads start
  useEffect(() => {
    if (hasUploads && isCollapsed) {
      setIsCollapsed(false)
    }
    // Auto-show when new uploads start
    if (hasUploads && isHidden) {
      setIsHidden(false)
    }
  }, [hasUploads, isCollapsed, isHidden])

  // Hide entire progress widget
  const handleHideAll = () => {
    setIsHidden(true)
  }

  // Clear all completed/failed uploads
  const handleClearCompleted = () => {
    const completedIds = uploadIds.filter(id => 
      ['done', 'error', 'canceled'].includes(uploads[id]?.stage)
    )
    completedIds.forEach(id => removeUpload(id))
  }

  // Remove individual upload
  const handleRemoveUpload = (uploadId) => {
    removeUpload(uploadId)
  }

  if (!hasUploads || isHidden) return null

  const activeUploads = uploadIds.filter(id => 
    ['starting', 'downloading', 'uploading'].includes(uploads[id]?.stage)
  )
  const completedUploads = uploadIds.filter(id => 
    ['done', 'error', 'canceled'].includes(uploads[id]?.stage)
  )

  return (
    <Fade in>
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 400,
          maxHeight: '60vh',
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Card
          sx={{
            background: 'rgba(17, 24, 39, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '12px 12px 0 0',
            borderBottom: isCollapsed ? '1px solid rgba(139, 92, 246, 0.3)' : 'none',
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="between" gap={2}>
              <Box display="flex" alignItems="center" gap={2}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 16, color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Upload Progress
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activeUploads.length} active, {completedUploads.length} completed
                  </Typography>
                </Box>
              </Box>
              
              <Box display="flex" alignItems="center" gap={1}>
                {completedUploads.length > 0 && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleClearCompleted}
                    sx={{ 
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      '&:hover': { backgroundColor: 'rgba(139, 92, 246, 0.1)' }
                    }}
                  >
                    Clear
                  </Button>
                )}
                
                <IconButton
                  size="small"
                  onClick={handleHideAll}
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': { backgroundColor: 'rgba(139, 92, 246, 0.1)' }
                  }}
                  title="Hide progress"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>

                <IconButton
                  size="small"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  sx={{ 
                    color: 'text.secondary',
                    transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  <ExpandLessIcon />
                </IconButton>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Upload List */}
        <Collapse in={!isCollapsed}>
          <Box
            sx={{
              background: 'rgba(17, 24, 39, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
              maxHeight: '50vh',
              overflow: 'auto',
              p: 2,
            }}
          >
            <AnimatePresence mode="popLayout">
              {uploadIds.map(uploadId => (
                <UploadProgressItem
                  key={uploadId}
                  uploadId={uploadId}
                  upload={uploads[uploadId]}
                  onRemove={handleRemoveUpload}
                />
              ))}
            </AnimatePresence>
          </Box>
        </Collapse>
      </Box>
    </Fade>
  )
}