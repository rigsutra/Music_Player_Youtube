// /routes/user.js - User management routes
const express = require('express');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      id: user._id,
      googleId: user.googleId,
      email: user.email,
      name: user.name,
      picture: user.picture,
      musicFolderId: user.musicFolderId,
      sessionCreated: user.createdAt,
      lastActive: user.lastActiveAt
    });
    
  } catch (error) {
    console.error(`Error fetching profile for user ${req.userId}:`, error.message);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (name) {
      req.user.name = name;
      await req.user.save();
    }
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email
      }
    });
    
  } catch (error) {
    console.error(`Error updating profile for user ${req.userId}:`, error.message);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Delete user account
router.delete('/account', authenticateUser, async (req, res) => {
  try {
    // Mark user as inactive instead of deleting
    req.user.isActive = false;
    await req.user.save();
    res.json({ message: 'Account deactivated successfully' });
    
  } catch (error) {
    console.error(`Error deactivating account for user ${req.userId}:`, error.message);
    res.status(500).json({ message: 'Failed to deactivate account' });
  }
});

module.exports = router;
