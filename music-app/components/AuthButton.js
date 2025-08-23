'use client'

import { Button, Box } from '@mui/material'
import { Google as GoogleIcon } from '@mui/icons-material'
import { motion } from 'framer-motion'
import { API_BASE } from '../lib/config'

export default function AuthButton({ onAuthSuccess }) {
  const handleAuth = () => {
    window.location.href = `${API_BASE}/auth/google`
  }

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button
        onClick={handleAuth}
        variant="contained"
        size="large"
        startIcon={<GoogleIcon />}
        sx={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%)',
          color: '#000000',
          fontWeight: 600,
          fontSize: '1.1rem',
          px: 4,
          py: 1.5,
          borderRadius: 3,
          textTransform: 'none',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
          '&:hover': {
            background: 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.2)',
          },
        }}
      >
        Connect Google Drive
      </Button>
    </motion.div>
  )
}