'use client'

import { 
  Card, 
  CardContent, 
  Typography, 
  IconButton, 
  Box, 
  Chip,
  Fade 
} from '@mui/material'
import { 
  PlayArrow as PlayIcon, 
  Pause as PauseIcon, 
  MusicNote as MusicNoteIcon,
  GraphicEq as EqualizerIcon 
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useMusicStore } from '../lib/store'
import { formatFileSize } from '../lib/utils'

export default function SongCard({ song, index, onClick }) {
  const { currentSong, isPlaying, isLoading } = useMusicStore()
  const isCurrentSong = currentSong?.id === song.id
  const isCurrentlyPlaying = isCurrentSong && isPlaying
  const isCurrentlyLoading = isCurrentSong && isLoading

  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick(song, index)
  }

  const handlePlayButtonClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick(song, index)
  }

  const songName = song.name?.replace(/\.(webm|mp3|m4a)$/, '') || 'Unknown Song'
  const dateAdded = new Date(song.createdTime).toLocaleDateString()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
    >
      <Card 
        sx={{
          cursor: 'pointer',
          height: 280,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          background: isCurrentSong 
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)'
            : 'linear-gradient(135deg, rgba(55, 65, 81, 0.6) 0%, rgba(31, 41, 55, 0.8) 100%)',
          border: isCurrentSong 
            ? '2px solid rgba(139, 92, 246, 0.5)' 
            : '1px solid rgba(75, 85, 99, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-8px)',
            boxShadow: isCurrentSong 
              ? '0 25px 50px rgba(139, 92, 246, 0.3)' 
              : '0 25px 50px rgba(0, 0, 0, 0.3)',
          },
        }}
      >
        {/* Currently Playing Indicator */}
        {isCurrentSong && (
          <Chip
            icon={<EqualizerIcon />}
            label="Now Playing"
            size="small"
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 2,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
        )}

        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
          {/* Play Button Section */}
          <Box display="flex" justifyContent="center" mb={3}>
            <IconButton
              onClick={handlePlayButtonClick}
              sx={{
                width: 80,
                height: 80,
                background: isCurrentSong 
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)'
                  : 'linear-gradient(135deg, rgba(75, 85, 99, 0.8) 0%, rgba(55, 65, 81, 0.9) 100%)',
                border: isCurrentSong ? '3px solid rgba(255, 255, 255, 0.3)' : '2px solid rgba(75, 85, 99, 0.5)',
                boxShadow: isCurrentSong 
                  ? '0 12px 24px rgba(139, 92, 246, 0.4)' 
                  : '0 8px 16px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1)',
                  background: isCurrentSong 
                    ? 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)'
                    : 'linear-gradient(135deg, rgba(55, 65, 81, 0.9) 0%, rgba(75, 85, 99, 1) 100%)',
                  boxShadow: isCurrentSong 
                    ? '0 16px 32px rgba(139, 92, 246, 0.5)' 
                    : '0 12px 24px rgba(0, 0, 0, 0.4)',
                },
              }}
            >
              {isCurrentlyLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <MusicNoteIcon sx={{ fontSize: 32, color: 'white' }} />
                </motion.div>
              ) : isCurrentlyPlaying ? (
                <PauseIcon sx={{ fontSize: 36, color: 'white' }} />
              ) : (
                <PlayIcon sx={{ fontSize: 36, color: 'white', ml: 0.5 }} />
              )}
            </IconButton>
          </Box>

          {/* Song Information */}
          <Box flex={1} display="flex" flexDirection="column" justifyContent="space-between">
            <Typography 
              variant="h6" 
              component="h3"
              sx={{
                fontWeight: 600,
                fontSize: '1.1rem',
                lineHeight: 1.3,
                mb: 2,
                color: isCurrentSong ? 'primary.light' : 'text.primary',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minHeight: '2.6rem',
              }}
            >
              {songName}
            </Typography>

            <Box>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ mb: 1, fontSize: '0.85rem' }}
              >
                Added {dateAdded}
              </Typography>
              
              {song.size && (
                <Chip 
                  label={formatFileSize(song.size)}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.75rem',
                    height: 24,
                    borderColor: 'rgba(75, 85, 99, 0.5)',
                    color: 'text.secondary',
                  }}
                />
              )}
            </Box>
          </Box>
        </CardContent>

        {/* Audio Visualizer for Currently Playing */}
        {isCurrentlyPlaying && (
          <Box 
            position="absolute"
            bottom={16}
            right={16}
            display="flex" 
            alignItems="end" 
            gap={0.5}
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                style={{
                  width: 3,
                  backgroundColor: '#8b5cf6',
                  borderRadius: 2,
                  background: 'linear-gradient(to top, #8b5cf6, #ec4899)',
                }}
                animate={{
                  height: [8, 24, 16, 32, 20],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </Box>
        )}
      </Card>
    </motion.div>
  )
}