// /components/UserProfile.js - User Profile Component
'use client'

import { useState } from 'react'
import {
  Box,
  Avatar,
  Typography,
  Button,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Chip
} from '@mui/material'
import {
  Person as PersonIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  LibraryMusic as LibraryMusicIcon
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'

export default function UserProfile() {
  const { user, logout, isAuthenticated } = useAuth()
  const [anchorEl, setAnchorEl] = useState(null)
  const open = Boolean(anchorEl)

  if (!isAuthenticated || !user) return null

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = () => {
    handleClose()
    logout()
  }

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={handleClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderRadius: 3,
            px: 2,
            py: 1,
            background: 'rgba(31, 41, 55, 0.8)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            '&:hover': {
              background: 'rgba(55, 65, 81, 0.9)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
            }
          }}
        >
          <Avatar
            src={user.picture}
            alt={user.name}
            sx={{ width: 32, height: 32 }}
          >
            {user.name?.charAt(0) || user.email?.charAt(0)}
          </Avatar>
          <Box textAlign="left" sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {user.name || 'User'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user.email}
            </Typography>
          </Box>
        </Button>
      </motion.div>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 280,
            background: 'rgba(31, 41, 55, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: 3,
          }
        }}
      >
        {/* User Info Header */}
        <Box sx={{ px: 3, py: 2 }}>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar
              src={user.picture}
              alt={user.name}
              sx={{ width: 48, height: 48 }}
            >
              {user.name?.charAt(0) || user.email?.charAt(0)}
            </Avatar>
            <Box flex={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {user.name || 'User'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
          </Box>
          
          {/* Account Stats */}
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip
              icon={<LibraryMusicIcon />}
              label="Personal Library"
              size="small"
              sx={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                color: 'white',
                fontSize: '0.75rem'
              }}
            />
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(139, 92, 246, 0.2)' }} />

        {/* Menu Items */}
        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <PersonIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2">Profile Settings</Typography>
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={handleClose}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2">Preferences</Typography>
          </ListItemText>
        </MenuItem>

        <Divider sx={{ borderColor: 'rgba(139, 92, 246, 0.2)' }} />

        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" color="error.main">
              Sign Out
            </Typography>
          </ListItemText>
        </MenuItem>

        {/* Footer */}
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Session since {new Date(user.sessionCreated).toLocaleDateString()}
          </Typography>
        </Box>
      </Menu>
    </>
  )
}