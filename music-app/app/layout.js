'use client'

import { Inter, Outfit } from 'next/font/google'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Toaster } from 'react-hot-toast'
import { theme } from '../lib/theme'
import AudioPlayer from '../components/AudioPlayer'
import UploadProgress from '../components/UploadProgress'
import UploadProgressManager from '../components/UploadProgressManager'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable}`}>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          {/* CRITICAL: Single centralized upload progress manager */}
          {/* This creates ONE SSE connection per upload ID, preventing duplicates */}
          <UploadProgressManager />

          {/* Main content */}
          {children}

          {/* Audio player */}
          <AudioPlayer />

          {/* Upload progress display (reads from store, no SSE connections) */}
          <UploadProgress />

          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1f2937',
                color: '#fff',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}