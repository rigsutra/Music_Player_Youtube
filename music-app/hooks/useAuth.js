// /hooks/useAuth.js - Authentication hook
'use client'

import { useState, useEffect } from 'react'
import { authService } from '../lib/auth'
import apiClient from '../lib/api'
import toast from 'react-hot-toast'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuthStatus()
    handleAuthCallback()
  }, [])

  const handleAuthCallback = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const authStatus = urlParams.get('auth')
    const token = urlParams.get('token')

    if (authStatus === 'success' && token) {
      authService.setToken(token)
      toast.success('Successfully authenticated!')
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname)
      // Fetch user profile
      fetchUserProfile()
    } else if (authStatus === 'error') {
      toast.error('Authentication failed. Please try again.')
      window.history.replaceState({}, document.title, window.location.pathname)
      setIsLoading(false)
    }
  }

  const checkAuthStatus = async () => {
    try {
      const token = authService.getToken()
      if (!token) {
        setIsLoading(false)
        return
      }

      const response = await apiClient.get('/auth/status')
      if (response.data.authenticated) {
        setIsAuthenticated(true)
        await fetchUserProfile()
      } else {
        authService.removeToken()
        setIsAuthenticated(false)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      authService.removeToken()
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUserProfile = async () => {
    try {
      const response = await apiClient.get('/api/user/profile')
      setUser(response.data)
      setIsAuthenticated(true)
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      setIsAuthenticated(false)
    }
  }

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      authService.removeToken()
      setUser(null)
      setIsAuthenticated(false)
      toast.success('Logged out successfully')
      // Reload page to reset all state
      window.location.reload()
    }
  }

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    refreshProfile: fetchUserProfile
  }
}
