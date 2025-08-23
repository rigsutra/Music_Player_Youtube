'use client'
'use client'

import { Box, Typography, IconButton, Chip } from '@mui/material'
import { PlayArrow as PlayIcon, Pause as PauseIcon, FavoriteBorder, Favorite, MusicNote as MusicNoteIcon } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useMusicStore } from '../lib/store'
import { formatFileSize } from '../lib/utils'

export default function SongCard({ song, index, onClick, onToggleLike }) {
  const { currentSong, isPlaying, isLoading } = useMusicStore()
  const isCurrentSong = currentSong?.id === song.id
  const isCurrentlyPlaying = isCurrentSong && isPlaying
  const isCurrentlyLoading = isCurrentSong && isLoading

  // Handle provisional/uploading songs
  const isUploading = song.uploadId && song.stage !== 'done'
  const isOptimistic = song.isOptimistic
  const isProcessing = isUploading || isOptimistic
  const displayName = song.name?.replace(/\.(webm|mp3|m4a)$/, '') || song.videoTitle || 'Unknown Song'

  const handlePlayPause = (e) => {
    e.stopPropagation()
    // Don't allow playing songs that are still uploading or processing
    if (isProcessing) return
    onClick(song, index)
  }

  const songName = displayName
  const dateAdded = new Date(song.createdTime).toLocaleDateString()

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
            : isOptimistic 
              ? 'linear-gradient(90deg, rgba(251,191,36,0.1), rgba(245,158,11,0.1))'
              : 'rgba(31,41,55,0.7)',
          border: isCurrentSong 
            ? '2px solid rgba(139,92,246,0.5)' 
            : isOptimistic
              ? '1px solid rgba(251,191,36,0.3)'
              : '1px solid rgba(75,85,99,0.2)',
          cursor: 'pointer',
          '&:hover': { 
            background: isOptimistic 
              ? 'linear-gradient(90deg, rgba(251,191,36,0.15), rgba(245,158,11,0.15))'
              : 'rgba(55,65,81,0.85)' 
          },
          transition: 'all 0.3s ease',
        }}
        onClick={() => onClick(song, index)}
      >
        {/* Left: Index & Play Button */}
        <Box display="flex" alignItems="center" gap={2} minWidth={80}>
          <Typography variant="body2" color="text.secondary" width={20} textAlign="center">
            {index}.
          </Typography>
          <IconButton
            onClick={handlePlayPause}
            disabled={isProcessing}
            sx={{
              width: 44,
              height: 44,
              background: isCurrentSong
                ? 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                : isProcessing 
                  ? 'rgba(75,85,99,0.4)'
                  : 'rgba(75,85,99,0.8)',
              borderRadius: '50%',
              '&:hover': { transform: isProcessing ? 'none' : 'scale(1.1)' },
              '&:disabled': { cursor: 'not-allowed' }
            }}
          >
            {isProcessing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                <MusicNoteIcon sx={{ color: 'rgba(255,255,255,0.6)' }} />
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
        <Box flex={1} minWidth={0} px={1}>
          <Typography variant="body1" fontWeight={isCurrentSong ? 600 : 400} noWrap 
            sx={{ opacity: isProcessing ? 0.7 : 1 }}
          >
            {songName} {isProcessing && (isOptimistic ? '(Processing...)' : '(Uploading...)')}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {isProcessing ? (isOptimistic ? 'Starting upload...' : 'Processing...') : `Added ${dateAdded}`} {song.size && `• ${formatFileSize(song.size)}`}
          </Typography>
        </Box>

        {/* Right: Now Playing & Like */}
        <Box display="flex" alignItems="center" gap={1}>
          {isCurrentSong && !isProcessing && (
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
          {isUploading && (
            <Chip
              label="Uploading"
              size="small"
              sx={{
                background: 'rgba(59, 130, 246, 0.8)',
                color: 'white',
                fontWeight: 600,
              }}
            />
          )}
          {isOptimistic && (
            <Chip
              label="Starting"
              size="small"
              sx={{
                background: 'rgba(251, 191, 36, 0.8)',
                color: 'white',
                fontWeight: 600,
              }}
            />
          )}
          <IconButton 
            onClick={(e) => { e.stopPropagation(); onToggleLike?.(song) }}
            disabled={isProcessing}
          >
            {song.liked ? <Favorite color="error" /> : <FavoriteBorder sx={{ color: 'text.secondary' }} />}
          </IconButton>
        </Box>
      </Box>
    </motion.div>
  )
}
