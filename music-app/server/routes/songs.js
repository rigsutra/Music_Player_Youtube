// /routes/songs.js - Fixed to include stage information
const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const googleDriveService = require('../services/googleDriveService');
const Upload = require('../models/Upload');

const router = express.Router();

// Get user's songs
router.get('/', authenticateUser, async (req, res) => {
  try {
    
    const files = await googleDriveService.listUserFiles(req.userId);
    
    // Get upload records for ALL files (not just completed) to include full upload info
    const uploads = await Upload.find({
      userId: req.userId,
      googleFileId: { $in: files.map(f => f.id) }
    }).select('uploadId googleFileId videoTitle stage progress isActive error');
    
    // Create lookup map with full upload info
    const uploadMap = uploads.reduce((map, upload) => {
      map[upload.googleFileId] = {
        uploadId: upload.uploadId,
        videoTitle: upload.videoTitle,
        stage: upload.stage,
        progress: upload.progress || 0,
        isActive: upload.isActive,
        error: upload.error
      };
      return map;
    }, {});
    
    // Enhance files with complete upload info
    const enhancedFiles = files.map(file => {
      const uploadInfo = uploadMap[file.id];
      return {
        ...file,
        uploadId: uploadInfo?.uploadId || null,
        videoTitle: uploadInfo?.videoTitle || file.name,
        stage: uploadInfo?.stage || 'done', // Default to 'done' for files without upload records
        progress: uploadInfo?.progress || 100, // Default to 100% for completed files
        isActive: uploadInfo?.isActive || false,
        error: uploadInfo?.error || null,
        isOptimistic: false // Since these are real files from Drive, they're not optimistic
      };
    });
    
    res.json(enhancedFiles);
    
  } catch (error) {
    console.error(`Error fetching songs for user ${req.userId}:`, error.message);
    
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
        console.error('Partial stream error:', e.message);
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
        console.error('Full stream error:', e.message);
        if (!res.headersSent) res.end();
      });
      
      full.data.pipe(res);
    }
    
  } catch (error) {
    
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

    // Also clean up the upload record if it exists
    await Upload.deleteOne({ 
      userId: req.userId, 
      googleFileId: fileId 
    });

    res.json({ message: 'Song deleted successfully' });
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete song' });
  }
});

module.exports = router;