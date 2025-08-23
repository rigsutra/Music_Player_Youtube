'use client'

import { useState, useEffect } from 'react'
import { 
  Container, 
  Typography, 
  Button, 
  Box, 
  CircularProgress,
  Card,
  CardContent,
  Fade
} from '@mui/material'
import { motion } from 'framer-motion'
import { 
  Add as AddIcon, 
  MusicNote as MusicNoteIcon, 
  LibraryMusic as LibraryMusicIcon 
} from '@mui/icons-material'
import { useMusicStore } from '../lib/store'
import AddSongModal from '../components/AddSongModal'
import SongCard from '../components/SongCard'
import AuthButton from '../components/AuthButton'
import toast from 'react-hot-toast'
import axios from 'axios'
import { API_BASE } from '../lib/config'

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  const { songs, setSongs, setCurrentSong } = useMusicStore()

  // --- AUTH CHECK ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    
    if (authStatus === 'success') {
      toast.success('Successfully authenticated with Google Drive!');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authStatus === 'error') {
      toast.error('Authentication failed. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    checkAuthStatus();
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchSongs();
  }, [isAuthenticated])

  // Reopen Add Song modal when background toast dispatches the event
  useEffect(() => {
    const handleOpenAddSong = () => setIsModalOpen(true)
    window.addEventListener('open-add-song', handleOpenAddSong)
    return () => window.removeEventListener('open-add-song', handleOpenAddSong)
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/auth/status`)
      setIsAuthenticated(response.data.authenticated)
    } catch (error) {
      console.error('Auth check failed:', error)
      setIsAuthenticated(false)
    }
  }

  // --- FETCH SONGS FROM DRIVE ---
  const fetchSongs = async (preserveOptimistic = false) => {
    try {
      // Don't show loading spinner if we already have songs (background refresh)
      if (songs.length === 0) {
        setIsLoading(true)
      }
      
      const response = await axios.get(`${API_BASE}/api/songs`)
      const serverSongs = Array.isArray(response.data) ? response.data : []
      
      // Simple approach: just set the server songs
      setSongs(serverSongs)
      
    } catch (error) {
      console.error('Failed to fetch songs:', error)
      if (error.response?.status === 401) {
        setIsAuthenticated(false)
        toast.error('Please authenticate with Google Drive')
      } else {
        toast.error('Failed to load songs')
      }
      // Don't reset songs array on error if we already have songs
      if (songs.length === 0) {
        setSongs([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSongClick = (song, index) => setCurrentSong(song, index)

  const handleSongAdded = (newSong) => {
    // Simple optimistic update - just add to the beginning
    setSongs(prev => [newSong, ...(Array.isArray(prev) ? prev : [])])
    toast.success(`"${newSong.videoTitle || newSong.name}" added!`)
  }

  if (!isAuthenticated) {
    return (
      <Container maxWidth="sm" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Fade in timeout={800}>
          <Box textAlign="center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
              <Box 
                sx={{
                  width: 80, height: 80, margin: '0 auto 24px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(139, 92, 246, 0.3)',
                }}
              >
                <MusicNoteIcon sx={{ fontSize: 40, color: 'white' }} />
              </Box>
            </motion.div>
            
            <Typography variant="h1" gutterBottom>Music Streaming App</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
              Stream music from YouTube directly to your Google Drive. Authenticate to get started.
            </Typography>
            
            <AuthButton onAuthSuccess={() => setIsAuthenticated(true)} />
          </Box>
        </Fade>
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Fade in timeout={600}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography variant="h1" gutterBottom>My Music Library</Typography>
            <Typography variant="body1" color="text.secondary">
              {Array.isArray(songs) ? songs.length : 0} song{(Array.isArray(songs) ? songs.length : 0) !== 1 ? 's' : ''} in your collection
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setIsModalOpen(true)}
            sx={{
              borderRadius: 3, px: 4, py: 1.5, fontSize: '1.1rem', minWidth: 160,
            }}
          >
            Add Song
          </Button>
        </Box>
      </Fade>

      {/* Song List */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress size={60} thickness={4} /></Box>
      ) : !Array.isArray(songs) || songs.length === 0 ? (
        <Fade in timeout={800}>
          <Card sx={{ textAlign: 'center', py: 8, px: 4, background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)', border: '2px dashed rgba(139, 92, 246, 0.3)' }}>
            <CardContent>
              <LibraryMusicIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h4" gutterBottom>No songs yet</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>Add your first song from YouTube</Typography>
              <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => setIsModalOpen(true)}>Add Your First Song</Button>
            </CardContent>
          </Card>
        </Fade>
      ) : (
        <Fade in timeout={1000}>
          <Box display="flex" flexDirection="column" gap={2}>
            {songs.map((song, index) => (
              <SongCard key={song.id} song={song} index={index} onClick={() => handleSongClick(song, index)} />
            ))}
          </Box>
        </Fade>
      )}

      {/* Add Song Modal */}
      <AddSongModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSongAdded={handleSongAdded}
        fetchSongsFromDrive={fetchSongs}  // <--- FIXED HERE
      />
    </Container>
  )
}
