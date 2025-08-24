//lib/api.js - Axios instance with JWT interceptor
'use client'

import axios from 'axios'
import { API_BASE } from './config'
import { authService } from './auth'
import toast from 'react-hot-toast'

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = authService.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authService.removeToken()
      toast.error('Session expired. Please login again.')
      // Redirect to home page to show login
      if (typeof window !== 'undefined') {
        window.location.href = '/'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
