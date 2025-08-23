'use client'

import { useEffect, useRef, useState } from 'react'
import { 
  Box, 
  IconButton, 
  Typography, 
  Slider, 
  Paper,
  Collapse,
  Fade
} from '@mui/material'
import { 
  PlayArrow as PlayIcon, 
  Pause as PauseIcon, 
  SkipNext as ForwardIcon, 
  SkipPrevious as BackwardIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  MusicNote as MusicNoteIcon
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useMusicStore } from '../lib/store'
import { formatTime } from '../lib/utils'

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-api-domain.com' 
  : 'http://localhost:8000'

export default function AudioPlayer() {
  const audioRef = useRef(null)
  const [isExpanded, setIsExpanded] = useState(false)
  
  const {
    currentSong,
    isPlaying,
    duration,
    currentTime,
    volume,
    isMuted,
    isPlayerVisible,
    isLoading,
    setIsPlaying,
    setDuration,
    setCurrentTime,
    setVolume,
    setMuted,
    setLoading,
    playNext,
    playPrevious,
    togglePlayPause,
    seekTo
  } = useMusicStore()

  // Initialize audio element
  useEffect(() => {
    if (currentSong && audioRef.current) {
      const audio = audioRef.current
      audio.src = `${API_BASE}/api/stream/${currentSong.id}`
      
      if (isPlaying) {
        audio.play().catch(console.error)
      }
    }
  }, [currentSong])

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadStart = () => setLoading(true)
    const handleCanPlay = () => setLoading(false)
    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleEnded = () => {
      setIsPlaying(false)
      playNext()
    }
    const handleError = (e) => {
      console.error('Audio error:', e)
      setLoading(false)
      setIsPlaying(false)
    }

    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [currentSong])

  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.play().catch(console.error)
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Handle volume
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const handleSeek = (event, newValue) => {
    const seekTime = (newValue / 100) * duration
    seekTo(seekTime)
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime
    }
  }

  const handleVolumeChange = (event, newValue) => {
    setVolume(newValue / 100)
    setMuted(false)
  }

  if (!isPlayerVisible || !currentSong) return null

  const songName = currentSong.name?.replace(/\.(webm|mp3|m4a)$/, '') || 'Unknown Song'
  const progressPercent = duration ? (currentTime / duration) * 100 : 0

  return (
    <>
      <audio ref={audioRef} preload="metadata" />
      
      <AnimatePresence>
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
        >
          <Paper
            elevation={24}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(17, 24, 39, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(139, 92, 246, 0.3)',
              zIndex: 1300,
            }}
          >
            {/* Expand/Collapse Button */}
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1,
              }}
            >
              <IconButton
                onClick={() => setIsExpanded(!isExpanded)}
                sx={{
                  width: 40,
                  height: 40,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                {isExpanded ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </IconButton>
            </Box>

            <Box sx={{ px: 3, py: isExpanded ? 3 : 2 }}>
              {/* Mini Player */}
              {!isExpanded && (
                <Box display="flex" alignItems="center" gap={2}>
                  {/* Song Info */}
                  <Box flex={1} minWidth={0}>
                    <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
                      {songName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </Typography>
                  </Box>

                  {/* Mini Controls */}
                  <Box display="flex" alignItems="center" gap={1}>
                    <IconButton onClick={playPrevious} size="small" sx={{ color: 'text.secondary' }}>
                      <BackwardIcon />
                    </IconButton>
                    
                    <IconButton
                      onClick={togglePlayPause}
                      disabled={isLoading}
                      sx={{
                        width: 48,
                        height: 48,
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                        color: 'white',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                        },
                        '&:disabled': {
                          background: 'rgba(75, 85, 99, 0.5)',
                        },
                      }}
                    >
                      {isLoading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <MusicNoteIcon />
                        </motion.div>
                      ) : isPlaying ? (
                        <PauseIcon />
                      ) : (
                        <PlayIcon />
                      )}
                    </IconButton>
                    
                    <IconButton onClick={playNext} size="small" sx={{ color: 'text.secondary' }}>
                      <ForwardIcon />
                    </IconButton>
                  </Box>
                </Box>
              )}

              {/* Expanded Player */}
              <Collapse in={isExpanded}>
                <Box sx={{ pt: isExpanded ? 2 : 0 }}>
                  {/* Song Info */}
                  <Box textAlign="center" mb={3}>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                      {songName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Added {new Date(currentSong.createdTime).toLocaleDateString()}
                    </Typography>
                  </Box>

                  {/* Progress Bar */}
                  <Box mb={3}>
                    <Slider
                      value={progressPercent}
                      onChange={handleSeek}
                      sx={{
                        height: 6,
                        '& .MuiSlider-thumb': {
                          width: 20,
                          height: 20,
                          '&:hover': {
                            boxShadow: '0 0 0 8px rgba(139, 92, 246, 0.16)',
                          },
                        },
                      }}
                    />
                    <Box display="flex" justifyContent="space-between" mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(currentTime)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(duration)}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Main Controls */}
                  <Box display="flex" justifyContent="center" alignItems="center" gap={2} mb={3}>
                    <IconButton 
                      onClick={playPrevious}
                      sx={{ 
                        width: 56, 
                        height: 56,
                        color: 'text.secondary',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <BackwardIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                    
                    <IconButton
                      onClick={togglePlayPause}
                      disabled={isLoading}
                      sx={{
                        width: 72,
                        height: 72,
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                        color: 'white',
                        boxShadow: '0 8px 25px rgba(139, 92, 246, 0.4)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                          boxShadow: '0 12px 30px rgba(139, 92, 246, 0.5)',
                        },
                        '&:disabled': {
                          background: 'rgba(75, 85, 99, 0.5)',
                        },
                      }}
                    >
                      {isLoading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <MusicNoteIcon sx={{ fontSize: 32 }} />
                        </motion.div>
                      ) : isPlaying ? (
                        <PauseIcon sx={{ fontSize: 36 }} />
                      ) : (
                        <PlayIcon sx={{ fontSize: 36 }} />
                      )}
                    </IconButton>
                    
                    <IconButton 
                      onClick={playNext}
                      sx={{ 
                        width: 56, 
                        height: 56,
                        color: 'text.secondary',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <ForwardIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                  </Box>

                  {/* Volume Control */}
                  <Box display="flex" alignItems="center" gap={2}>
                    <IconButton
                      onClick={() => setMuted(!isMuted)}
                      sx={{ color: 'text.secondary' }}
                    >
                      {isMuted || volume === 0 ? <VolumeOffIcon /> : <VolumeUpIcon />}
                    </IconButton>
                    
                    <Slider
                      value={isMuted ? 0 : volume * 100}
                      onChange={handleVolumeChange}
                      sx={{ 
                        maxWidth: 120,
                        '& .MuiSlider-thumb': {
                          width: 16,
                          height: 16,
                        },
                      }}
                    />
                  </Box>
                </Box>
              </Collapse>
            </Box>
          </Paper>
        </motion.div>
      </AnimatePresence>
    </>
  )
}