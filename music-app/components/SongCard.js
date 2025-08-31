// /components/SongCard.js - Fixed processing logic
'use client'

import { Box, Typography, IconButton, Chip, LinearProgress, Tooltip, Button, Menu, MenuItem } from '@mui/material'
import { 
  PlayArrow as PlayIcon, 
  Pause as PauseIcon, 
  FavoriteBorder, 
  Favorite, 
  MusicNote as MusicNoteIcon,
  CloudDownload as DownloadIcon,
  CloudUpload as UploadIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useMusicStore } from '../lib/store'
import { formatFileSize } from '../lib/utils'
import useUploadProgress from '../hooks/useUploadProgress'
import { useUploadStore } from '../lib/uploadStore'
import apiClient from '../lib/api'
import toast from 'react-hot-toast'

export default function SongCard({ song, index, onClick, onToggleLike, totalSongs, isInPlaylist = false, onSongDeleted }) {
  const { currentSong, isPlaying, isLoading } = useMusicStore()
  const isCurrentSong = currentSong?.id === song.id
  const isCurrentlyPlaying = isCurrentSong && isPlaying
  const isCurrentlyLoading = isCurrentSong && isLoading

  // Menu state
  const [menuAnchor, setMenuAnchor] = useState(null)
  const isMenuOpen = Boolean(menuAnchor)

  // Track upload progress ONLY if this is an active upload
  const shouldTrackProgress = song.uploadId && song.isActive
  useUploadProgress(shouldTrackProgress ? song.uploadId : null)

  // Read live upload state from the upload store (only for active uploads)
  const uploadState = shouldTrackProgress ? useUploadStore((s) => s.uploads[song.uploadId]) : null
  
  // Determine the current stage and progress
  // Priority: live upload state > database stage > default 'done'
  const currentStage = uploadState?.stage || song.stage || 'done'
  const progress = uploadState?.progress || song.progress || (currentStage === 'done' ? 100 : 0)
  const error = uploadState?.error || song.error

  // Determine processing state
  const isUploading = ['starting', 'downloading', 'uploading'].includes(currentStage) && song.isActive
  const hasError = currentStage === 'error'
  const isOptimistic = song.isOptimistic === true && !uploadState // Only true optimistic songs
  const isProcessing = isUploading || isOptimistic
  
  // Display name
  const displayName = song.name?.replace(/\.(webm|mp3|m4a)$/, '') || song.videoTitle || 'Unknown Song'

  // Calculate display number (newest songs get highest numbers)
  const displayNumber = totalSongs - index

  const handlePlayPause = (e) => {
    e.stopPropagation()
    // Don't allow playing songs that are still uploading or processing
    if (isProcessing || hasError) return
    onClick(song, index)
  }

  const handleRetry = async (e) => {
    e.stopPropagation()
    if (!song.uploadId) return

    try {
      await apiClient.post(`/api/upload/retry/${song.uploadId}`)
      toast.success('Retrying upload...')
    } catch (error) {
      toast.error('Failed to retry upload')
    }
  }

  // Menu handlers
  const handleMenuOpen = (e) => {
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
  }

  const handleDelete = async () => { 
    handleMenuClose()
    try {
      await apiClient.delete(`/api/songs/${song.id}`)
      toast.success('Song deleted successfully')

      onSongDeleted?.()
    } catch (error) {
      toast.error('Failed to delete song')
    }
  }

  const handleAddToPlaylist = () => {
    handleMenuClose()
    toast.success('Add to playlist feature coming soon!')
  }

  const handleRemoveFromPlaylist = () => {
    handleMenuClose()
    toast.success('Removed from playlist')
  }

  const getStageLabel = () => {
    switch (currentStage) {
      case 'starting': return 'Initializing'
      case 'downloading': return `Downloading (${progress}%)`
      case 'uploading': return `Uploading (${progress}%)`
      case 'done': return 'Ready'
      case 'error': return 'Failed'
      case 'canceled': return 'Canceled'
      default: return isOptimistic ? 'Queued' : 'Ready'
    }
  }

  const getStageColor = () => {
    switch (currentStage) {
      case 'downloading': return '#3b82f6'
      case 'uploading': return '#8b5cf6'
      case 'done': return '#10b981'
      case 'error': return '#ef4444'
      case 'canceled': return '#6b7280'
      default: return isOptimistic ? '#f59e0b' : '#10b981'
    }
  }

  const songName = displayName
  const dateAdded = new Date(song.createdTime).toLocaleDateString()

  // // Debug logging (remove in production)
  // console.log(`Song ${song.id} - Stage: ${currentStage}, Processing: ${isProcessing}, Optimistic: ${isOptimistic}, Active: ${song.isActive}`)

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        p={1.5}
        mb={1.5}
        sx={{
          width: '100%',
          borderRadius: 2,
          background: isCurrentSong
            ? 'linear-gradient(90deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2))'
            : hasError
              ? 'linear-gradient(90deg, rgba(239,68,68,0.1), rgba(220,38,38,0.1))'
              : isProcessing
                ? 'linear-gradient(90deg, rgba(251,191,36,0.1), rgba(245,158,11,0.1))'
                : 'rgba(31,41,55,0.7)',
          border: isCurrentSong
            ? '2px solid rgba(139,92,246,0.5)'
            : hasError
              ? '1px solid rgba(239,68,68,0.3)'
              : isProcessing
                ? '1px solid rgba(251,191,36,0.3)'
                : '1px solid rgba(75,85,99,0.2)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            background: hasError
              ? 'linear-gradient(90deg, rgba(239,68,68,0.15), rgba(220,38,38,0.15))'
              : isProcessing
                ? 'linear-gradient(90deg, rgba(251,191,36,0.15), rgba(245,158,11,0.15))'
                : 'rgba(55,65,81,0.85)'
          },
          transition: 'all 0.3s ease',
        }}
        onClick={() => !hasError && onClick(song, index)}
      >
        {/* Progress bar background */}
        {isProcessing && progress > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${getStageColor()}22, ${getStageColor()}11)`,
              transition: 'width 0.5s ease',
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Left: Index & Play Button */}
        <Box display="flex" alignItems="center" gap={2} minWidth={80} position="relative">
          <Typography variant="body2" color="text.secondary" width={20} textAlign="center">
            {displayNumber}.
          </Typography>
          <IconButton
            onClick={handlePlayPause}
            disabled={isProcessing || hasError}
            sx={{
              width: 44,
              height: 44,
              background: isCurrentSong
                ? 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                : hasError
                  ? 'rgba(239,68,68,0.5)'
                  : isProcessing
                    ? 'rgba(75,85,99,0.4)'
                    : 'rgba(75,85,99,0.8)',
              borderRadius: '50%',
              '&:hover': { transform: isProcessing || hasError ? 'none' : 'scale(1.1)' },
              '&:disabled': { cursor: 'not-allowed' }
            }}
          >
            {hasError ? (
              <ErrorIcon sx={{ color: 'white' }} />
            ) : isProcessing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                {currentStage === 'downloading' ? (
                  <DownloadIcon sx={{ color: 'rgba(255,255,255,0.8)' }} />
                ) : currentStage === 'uploading' ? (
                  <UploadIcon sx={{ color: 'rgba(255,255,255,0.8)' }} />
                ) : (
                  <MusicNoteIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
                )}
              </motion.div>
            ) : isCurrentlyLoading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <MusicNoteIcon sx={{ color: 'white' }} />
              </motion.div>
            ) : isCurrentlyPlaying ? (
              <PauseIcon sx={{ color: 'white' }} />
            ) : (
              <PlayIcon sx={{ color: 'white' }} />
            )}
          </IconButton>
        </Box>

        {/* Center: Song Info */}
        <Box flex={1} minWidth={0} px={1} position="relative">
          <Typography 
            variant="body1" 
            fontWeight={isCurrentSong ? 600 : 400} 
            noWrap
            sx={{ opacity: hasError ? 0.7 : isProcessing ? 0.8 : 1 }}
          >
            {songName}
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {isProcessing || hasError ? (
                <>
                  {getStageLabel()}
                  {error && !hasError && ` • ${error}`}
                </>
              ) : (
                <>
                  Added {dateAdded}
                  {song.size && ` • ${formatFileSize(song.size)}`}
                </>
              )}
            </Typography>
            {isProcessing && progress > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={progress} 
                  sx={{ 
                    width: 60, 
                    height: 4, 
                    borderRadius: 2,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: getStageColor()
                    }
                  }} 
                />
                <Typography variant="caption" color="text.secondary">
                  {progress}%
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Right: Status & Actions */}
        <Box display="flex" alignItems="center" gap={1}>
          {isCurrentSong && !isProcessing && !hasError && (
            <Chip
              label={isCurrentlyPlaying ? 'Now Playing' : 'Paused'}
              size="small"
              sx={{
                background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                color: 'white',
                fontWeight: 600,
              }}
            />
          )}
          
          {currentStage === 'downloading' && isProcessing && (
            <Tooltip title={`Downloading: ${progress}%`}>
              <Chip
                icon={<DownloadIcon sx={{ fontSize: 16 }} />}
                label={`${progress}%`}
                size="small"
                sx={{
                  background: 'rgba(59, 130, 246, 0.8)',
                  color: 'white',
                  fontWeight: 600,
                }}
              />
            </Tooltip>
          )}
          
          {currentStage === 'uploading' && isProcessing && (
            <Tooltip title={`Uploading to Drive: ${progress}%`}>
              <Chip
                icon={<UploadIcon sx={{ fontSize: 16 }} />}
                label={`${progress}%`}
                size="small"
                sx={{
                  background: 'rgba(139, 92, 246, 0.8)',
                  color: 'white',
                  fontWeight: 600,
                }}
              />
            </Tooltip>
          )}
          
          {hasError && (
            <Tooltip title={error || 'Upload failed'}>
              <Button
                size="small"
                variant="contained"
                onClick={handleRetry}
                startIcon={<RefreshIcon />}
                sx={{
                  background: 'rgba(239, 68, 68, 0.8)',
                  '&:hover': { background: 'rgba(220, 38, 38, 0.9)' },
                  minWidth: 80,
                  fontSize: '0.75rem'
                }}
              >
                Retry
              </Button>
            </Tooltip>
          )}
          
          {isOptimistic && (
            <Chip
              label="Queued"
              size="small"
              sx={{
                background: 'rgba(251, 191, 36, 0.8)',
                color: 'white',
                fontWeight: 600,
              }}
            />
          )}

          <IconButton
            onClick={(e) => { e.stopPropagation(); handleMenuOpen(e); }}
            size="small"
          >
            <MoreVertIcon />
          </IconButton>

          <IconButton
            onClick={(e) => { 
              e.stopPropagation(); 
              toast.success('Like feature coming soon!');
            }}
            size="small"
          >
            {song.liked ? <Favorite color="error" /> : <FavoriteBorder sx={{ color: 'text.secondary' }} />}
          </IconButton>
        </Box>
      </Box>

      {/* Options Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={isMenuOpen}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: 'rgba(31, 41, 55, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(75, 85, 99, 0.3)',
          }
        }}
      >
        <MenuItem onClick={(e) => { e.stopPropagation(); handleDelete(); }} sx={{ color: 'error.main' }}>
          Delete
        </MenuItem>
        <MenuItem onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(); }}>
          Add to Playlist
        </MenuItem>
        {isInPlaylist && (
          <MenuItem onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(); }}>
            Remove from Playlist
          </MenuItem>
        )}
      </Menu>
    </motion.div>
  )
}