'use client'

import { ThemeProvider, CssBaseline } from '@mui/material'
import { Toaster } from 'react-hot-toast'
import { theme } from '../lib/theme'
import AudioPlayer from '../components/AudioPlayer'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Music Streaming App</title>
        <meta name="description" content="Stream music from YouTube to Google Drive" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body>
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
      </body>
    </html>
  )
}