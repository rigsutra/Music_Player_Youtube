// /routes/songs.js - Song management routes
const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const googleDriveService = require('../services/googleDriveService');

const router = express.Router();

// Get user's songs
router.get('/', authenticateUser, async (req, res) => {
  try {
    console.log(`🎵 Fetching songs for user ${req.user.googleId}`);
    
    const files = await googleDriveService.listUserFiles(req.userId);
    
    console.log(`✅ Retrieved ${files.length} songs for user ${req.user.googleId}`);
    res.json(files);
    
  } catch (error) {
    console.error(`❌ Error fetching songs for user ${req.userId}:`, error.message);
    
    if (error.message.includes('User not found')) {
      return res.status(401).json({
        message: 'User session expired',
        authUrl: '/auth/google'
      });
    }
    
    res.status(500).json({
      message: 'Failed to retrieve songs'
    });
  }
});

// Stream a song
router.get('/stream/:fileId', authenticateUser, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    console.log(`🎧 User ${req.user.googleId} streaming file ${fileId}`);
    
    const { drive, fileInfo } = await googleDriveService.streamFile(req.userId, fileId);
    
    const size = parseInt(fileInfo.size, 10);
    const mime = fileInfo.mimeType || 'audio/webm';
    const range = req.headers.range;
    
    if (range) {
      // Handle range requests for seeking
      const m = range.match(/bytes=(\d*)-(\d*)/);
      if (!m) return res.status(416).end();
      
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : size - 1;
      
      if (isNaN(start) || isNaN(end) || start > end || end >= size) {
        return res.status(416).end();
      }
      
      const chunkSize = end - start + 1;
      const partial = await drive.files.get({
        fileId,
        alt: 'media'
      }, {
        responseType: 'stream',
        headers: { Range: `bytes=${start}-${end}` }
      });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=3600'
      });
      
      partial.data.on('error', e => {
        console.error('❌ Partial stream error:', e.message);
        if (!res.headersSent) res.end();
      });
      
      partial.data.pipe(res);
    } else {
      // Full file stream
      const full = await drive.files.get({
        fileId,
        alt: 'media'
      }, {
        responseType: 'stream'
      });
      
      res.writeHead(200, {
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=3600'
      });
      
      full.data.on('error', e => {
        console.error('❌ Full stream error:', e.message);
        if (!res.headersSent) res.end();
      });
      
      full.data.pipe(res);
    }
    
  } catch (error) {
    console.error(`❌ Error streaming file for user ${req.userId}:`, error.message);
    
    if (error.message.includes('Access denied')) {
      return res.status(403).send(error.message);
    }
    
    if (error.message.includes('User not found')) {
      return res.status(401).json({
        message: 'User session expired',
        authUrl: '/auth/google'
      });
    }
    
    res.status(500).send('Could not stream the file');
  }
});

// Delete a song
router.delete('/:fileId', authenticateUser, async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const { drive } = await googleDriveService.streamFile(req.userId, fileId);
    
    await drive.files.delete({ fileId });
    
    console.log(`🗑️ User ${req.user.googleId} deleted file ${fileId}`);
    res.json({ message: 'Song deleted successfully' });
    
  } catch (error) {
    console.error(`❌ Error deleting file for user ${req.userId}:`, error.message);
    res.status(500).json({ message: 'Failed to delete song' });
  }
});

module.exports = router;
