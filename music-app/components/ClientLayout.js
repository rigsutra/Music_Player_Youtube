'use client'

import { ThemeProvider, CssBaseline } from '@mui/material'
import { Toaster } from 'react-hot-toast'
import { theme } from '../lib/theme'
import AudioPlayer from './AudioPlayer'

export default function ClientLayout({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ minHeight: '100vh', paddingBottom: '100px' }}>
        {children}
      </div>
      
      {/* Global Audio Player - Always visible when playing */}
      <AudioPlayer />
      
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(31, 41, 55, 0.95)',
            color: '#fff',
            border: '1px solid rgba(75, 85, 99, 0.3)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
          },
        }}
      />
    </ThemeProvider>
  )
}