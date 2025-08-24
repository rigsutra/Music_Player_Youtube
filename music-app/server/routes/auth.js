// /routes/auth.js - Authentication routes
const express = require('express');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const crypto = require('crypto');
const User = require('../models/User');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Google OAuth login
router.get('/google', (req, res) => {
  const state = crypto.randomUUID();
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'openid',
      'email', 
      'profile'
    ],
    prompt: 'consent',
    state
  });
  
  console.log('🔐 Redirecting to Google OAuth...');
  res.redirect(url);
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Basic state validation (you could store states in session/redis for better security)
    if (!state || !code) {
      throw new Error('Missing required parameters');
    }
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Get tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    const { id: googleId, email, name, picture } = userInfo.data;
    
    console.log(`🔐 User ${googleId} (${email}) authenticating...`);
    
    // Find or create user
    let user = await User.findOne({ googleId });
    
    if (user) {
      // Update existing user
      user.email = email;
      user.name = name;
      user.picture = picture;
      user.googleTokens = tokens;
      user.isActive = true;
      console.log(`✅ Existing user ${googleId} updated`);
    } else {
      // Create new user
      user = new User({
        googleId,
        email,
        name,
        picture,
        googleTokens: tokens
      });
      console.log(`🆕 New user ${googleId} created`);
    }
    
    await user.save();

    console.log("User information retrieved successfully");
    // Create JWT token
    const jwtToken = jwt.sign(
      { userId: user._id, email, googleId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log("redirect with token");
    // Redirect with token
    const redirectUrl = process.env.NODE_ENV === 'production'
      ? `${process.env.NEXT_PUBLIC_PROD_FRONTEND_API}?auth=success&token=${jwtToken}`
      : `http://localhost:3000?auth=success&token=${jwtToken}`;
      
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('❌ OAuth callback error:', error.message);
    const redirectUrl = process.env.NODE_ENV === 'production'
      ? `${process.env.NEXT_PUBLIC_PROD_FRONTEND_API}?auth=error`
      : 'http://localhost:3000?auth=error';
    res.redirect(redirectUrl);
  }
});

// Check authentication status
router.get('/status', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.json({
      authenticated: false,
      downloader: 'youtube-dl-exec'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.json({
        authenticated: false,
        downloader: 'youtube-dl-exec'
      });
    }

    res.json({
      authenticated: true,
      userId: user._id,
      googleId: user.googleId,
      email: user.email,
      downloader: 'youtube-dl-exec',
      folderName: `Music Player - ${user.name}`,
      securityMode: 'MULTI-USER - MongoDB + Per-user folder isolation'
    });
    
  } catch (error) {
    res.json({
      authenticated: false,
      downloader: 'youtube-dl-exec'
    });
  }
});

// Logout
router.post('/logout', authenticateUser, async (req, res) => {
  try {
    // Optional: Could mark user as inactive or clear tokens
    // req.user.isActive = false;
    // await req.user.save();
    
    console.log(`🚪 User ${req.user.googleId} logged out`);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ Logout error:', error.message);
    res.status(500).json({ message: 'Logout failed' });
  }
});

module.exports = router;