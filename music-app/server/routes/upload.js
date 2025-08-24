// /routes/upload.js - Upload management routes
const express = require('express');
const crypto = require('crypto');
const { authenticateUser } = require('../middleware/auth');
const googleDriveService = require('../services/googleDriveService');
const { isValidYouTubeUrl, sanitizeFileName, getVideoInfo, createAudioStream } = require('../utils/youtube');
const Upload = require('../models/Upload');

const router = express.Router();

// Start upload
router.post('/start', authenticateUser, async (req, res) => {
  try {
    const { youtubeUrl, fileName } = req.body;
    
    if (!youtubeUrl || !isValidYouTubeUrl(youtubeUrl)) {
      return res.status(400).json({ message: 'Invalid YouTube URL' });
    }

    const uploadId = crypto.randomUUID();
    
    console.log(`🎵 User ${req.user.googleId} starting upload: ${youtubeUrl}`);
    
    // Get video info
    const videoInfo = await getVideoInfo(youtubeUrl);
    const safeName = sanitizeFileName(fileName || videoInfo.title) + '.webm';
    
    // Create upload record
    const upload = new Upload({
      uploadId,
      userId: req.userId,
      youtubeUrl,
      videoTitle: videoInfo.title,
      fileName: safeName
    });
    
    await upload.save();
    
    // Return immediately
    res.json({
      uploadId,
      fileName: safeName,
      videoTitle: videoInfo.title
    });
    
    // Process upload asynchronously
    processUpload(upload);
    
  } catch (error) {
    console.error(`❌ Upload start error for user ${req.userId}:`, error.message);
    res.status(500).json({
      message: 'Failed to start upload'
    });
  }
});

// Get upload progress
router.get('/progress/:uploadId', authenticateUser, async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const upload = await Upload.findOne({
      uploadId,
      userId: req.userId,
      isActive: true
    });
    
    if (!upload) {
      return res.json({
        progress: 0,
        stage: 'not_found'
      });
    }
    
    res.json({
      progress: upload.progress,
      stage: upload.stage,
      error: upload.error
    });
    
  } catch (error) {
    console.error(`❌ Progress check error:`, error.message);
    res.status(500).json({
      progress: 0,
      stage: 'error'
    });
  }
});

// Cancel upload
router.post('/cancel/:uploadId', authenticateUser, async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const upload = await Upload.findOne({
      uploadId,
      userId: req.userId,
      isActive: true
    });
    
    if (!upload) {
      return res.status(404).json({ message: 'Upload not found' });
    }
    
    upload.stage = 'canceled';
    upload.isActive = false;
    await upload.save();
    
    console.log(`🚫 Upload canceled by user ${req.user.googleId}: ${uploadId}`);
    res.json({ message: 'Upload canceled' });
    
  } catch (error) {
    console.error('❌ Cancel upload error:', error.message);
    res.status(500).json({ message: 'Failed to cancel upload' });
  }
});

// SSE Progress endpoint
router.get('/progress/:uploadId/stream', authenticateUser, (req, res) => {
  const { uploadId } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const interval = setInterval(async () => {
    try {
      const upload = await Upload.findOne({
        uploadId,
        userId: req.userId,
        isActive: true
      });
      
      if (!upload) {
        res.write(`data: ${JSON.stringify({ progress: 0, stage: 'not_found' })}\n\n`);
        clearInterval(interval);
        res.end();
        return;
      }
      
      res.write(`data: ${JSON.stringify({
        progress: upload.progress,
        stage: upload.stage,
        error: upload.error
      })}\n\n`);
      
      // Close connection when done
      if (['done', 'error', 'canceled'].includes(upload.stage)) {
        clearInterval(interval);
        res.end();
      }
    } catch (error) {
      console.error('SSE error:', error.message);
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// Async upload processing function
async function processUpload(upload) {
  try {
    console.log(`🔄 Processing upload ${upload.uploadId}`);
    
    // Update to downloading
    upload.stage = 'downloading';
    await upload.save();
    
    // Create audio stream with progress callback
    const { stream } = await createAudioStream(upload.youtubeUrl, async (progress) => {
      upload.progress = Math.min(99, progress);
      await upload.save();
    });
    
    // Update to uploading
    upload.stage = 'uploading';
    upload.progress = 0;
    await upload.save();
    
    // Upload to Google Drive
    const fileId = await googleDriveService.uploadFile(
      upload.userId,
      upload.fileName,
      stream,
      'audio/webm'
    );
    
    // Mark as complete
    upload.stage = 'done';
    upload.progress = 100;
    upload.googleFileId = fileId;
    await upload.save();
    
    console.log(`✅ Upload completed: ${upload.uploadId} -> ${fileId}`);
    
  } catch (error) {
    console.error(`❌ Upload processing failed for ${upload.uploadId}:`, error.message);
    
    upload.stage = 'error';
    upload.error = error.message;
    await upload.save();
  }
}

module.exports = router;