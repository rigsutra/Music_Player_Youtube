// /routes/upload.js - Upload management routes with improved error handling
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
    
    // Get video info with error handling
    let videoInfo;
    try {
      videoInfo = await getVideoInfo(youtubeUrl);
    } catch (error) {
      console.error('⚠️ Could not fetch video info, using defaults:', error.message);
      videoInfo = {
        title: fileName || 'Downloaded Audio',
        duration: null,
        thumbnail: null
      };
    }
    
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
    processUpload(upload).catch(error => {
      console.error(`❌ Async upload processing failed for ${uploadId}:`, error.message);
    });
    
  } catch (error) {
    console.error(`❌ Upload start error for user ${req.userId}:`, error.message);
    res.status(500).json({
      message: 'Failed to start upload',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      error: upload.error,
      retryCount: upload.retryCount || 0
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

// Retry upload
router.post('/retry/:uploadId', authenticateUser, async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const upload = await Upload.findOne({
      uploadId,
      userId: req.userId,
      stage: 'error'
    });
    
    if (!upload) {
      return res.status(404).json({ message: 'Upload not found or not in error state' });
    }
    
    // Reset upload state
    upload.stage = 'starting';
    upload.progress = 0;
    upload.error = null;
    upload.isActive = true;
    upload.retryCount = (upload.retryCount || 0) + 1;
    await upload.save();
    
    console.log(`🔄 Retrying upload ${uploadId} (attempt ${upload.retryCount})`);
    res.json({ message: 'Upload retry started', retryCount: upload.retryCount });
    
    // Process upload again
    processUpload(upload).catch(error => {
      console.error(`❌ Retry failed for ${uploadId}:`, error.message);
    });
    
  } catch (error) {
    console.error('❌ Retry upload error:', error.message);
    res.status(500).json({ message: 'Failed to retry upload' });
  }
});

// Add this to your /routes/upload.js file - replace the existing SSE endpoint

// SSE Progress endpoint - FIXED VERSION
router.get('/progress/:uploadId/stream', async (req, res) => {
  const { uploadId } = req.params;
  
  // Get token from query parameter since EventSource doesn't support headers
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    // Verify JWT token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('../models/User');
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Prevent nginx buffering
    });

    // Send initial ping
    res.write(':ok\n\n');

    const interval = setInterval(async () => {
      try {
        const upload = await Upload.findOne({
          uploadId,
          userId: decoded.userId
        });
        
        if (!upload) {
          res.write(`data: ${JSON.stringify({ 
            progress: 0, 
            stage: 'not_found' 
          })}\n\n`);
          clearInterval(interval);
          res.end();
          return;
        }
        
        // Send the update
        const data = {
          progress: upload.progress || 0,
          stage: upload.stage,
          error: upload.error,
          googleFileId: upload.googleFileId,
          videoTitle: upload.videoTitle,
          fileName: upload.fileName
        };
        
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        
        // Close connection when done
        if (['done', 'error', 'canceled'].includes(upload.stage)) {
          clearInterval(interval);
          setTimeout(() => res.end(), 1000);
        }
      } catch (error) {
        console.error('SSE update error:', error.message);
        clearInterval(interval);
        res.end();
      }
    }, 1000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(interval);
    });
    
  } catch (error) {
    console.error('SSE auth error:', error.message);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Updated processUpload function for /routes/upload.js
// Replace the existing processUpload function with this one

// Fixed processUpload function for /routes/upload.js
// Replace the existing processUpload function with this one

async function processUpload(upload) {
  let progressUpdateInterval = null;
  let isSaving = false; // Flag to prevent parallel saves
  
  try {
    console.log(`🔄 Processing upload ${upload.uploadId}`);

    // Check if canceled before starting
    const checkUpload = await Upload.findById(upload._id);
    if (checkUpload.stage === 'canceled') {
      console.log(`Upload ${upload.uploadId} was canceled before processing`);
      return;
    }

    // Update to downloading with initial progress
    upload.stage = 'downloading';
    upload.progress = 0;
    await upload.save();

    // Create audio stream with progress callback
    let stream;
    let lastProgress = 0;
    
    try {
      const result = await createAudioStream(upload.youtubeUrl, async (progress) => {
        // Prevent parallel saves
        if (isSaving) return;
        
        // Only update if progress changed significantly (every 5%)
        if (Math.abs(progress - lastProgress) >= 5 || progress === 100) {
          lastProgress = progress;
          
          // Set flag and save
          isSaving = true;
          try {
            // Re-fetch the document to avoid version conflicts
            const currentUpload = await Upload.findById(upload._id);
            if (currentUpload && currentUpload.stage === 'downloading') {
              currentUpload.progress = Math.min(99, progress);
              await currentUpload.save();
              console.log(`📊 Download progress for ${upload.uploadId}: ${progress}%`);
            }
          } catch (e) {
            console.error('Failed to save progress:', e.message);
          } finally {
            isSaving = false;
          }
        }
      });
      
      stream = result?.stream;
      if (!stream) {
        throw new Error('No stream returned from createAudioStream');
      }
    } catch (err) {
      console.error(`❌ Failed to create audio stream for ${upload.uploadId}:`, err.message);
      
      // Save error state (re-fetch to avoid conflicts)
      const errorUpload = await Upload.findById(upload._id);
      if (errorUpload) {
        errorUpload.stage = 'error';
        errorUpload.error = `Download failed: ${err.message}`;
        errorUpload.isActive = false;
        await errorUpload.save();
      }
      return;
    }

    // Handle stream errors
    if (stream.on) {
      stream.on('error', async (err) => {
        console.error(`Stream error for upload ${upload.uploadId}:`, err.message);
        
        // Prevent parallel error saves
        if (!isSaving) {
          isSaving = true;
          try {
            const errorUpload = await Upload.findById(upload._id);
            if (errorUpload && errorUpload.stage !== 'error') {
              errorUpload.stage = 'error';
              errorUpload.error = `Stream error: ${err.message}`;
              errorUpload.isActive = false;
              await errorUpload.save();
            }
          } catch (saveErr) {
            console.error('Failed to save error state:', saveErr.message);
          } finally {
            isSaving = false;
          }
        }
      });
    }

    // Check if canceled before uploading
    const checkUpload2 = await Upload.findById(upload._id);
    if (checkUpload2.stage === 'canceled') {
      console.log(`Upload ${upload.uploadId} was canceled after download`);
      return;
    }

    // Update to uploading phase
    const uploadingDoc = await Upload.findById(upload._id);
    uploadingDoc.stage = 'uploading';
    uploadingDoc.progress = 0;
    await uploadingDoc.save();

    // Track upload progress to Google Drive
    let uploadStartTime = Date.now();
    let estimatedUploadTime = 30000; // Estimate 30 seconds for upload
    
    // Start a progress simulator for upload
    progressUpdateInterval = setInterval(async () => {
      if (isSaving) return; // Skip if already saving
      
      const elapsed = Date.now() - uploadStartTime;
      const estimatedProgress = Math.min(90, Math.floor((elapsed / estimatedUploadTime) * 100));
      
      isSaving = true;
      try {
        const currentUpload = await Upload.findById(upload._id);
        if (currentUpload && currentUpload.stage === 'uploading') {
          currentUpload.progress = estimatedProgress;
          await currentUpload.save();
          console.log(`📤 Upload progress for ${upload.uploadId}: ${estimatedProgress}%`);
        } else {
          clearInterval(progressUpdateInterval);
        }
      } catch (e) {
        console.error('Failed to update upload progress:', e.message);
      } finally {
        isSaving = false;
      }
    }, 3000); // Reduce frequency to every 3 seconds

    // Upload to Google Drive
    let fileId;
    try {
      fileId = await googleDriveService.uploadFile(
        upload.userId,
        uploadingDoc.fileName,
        stream,
        'audio/webm'
      );
    } catch (err) {
      clearInterval(progressUpdateInterval);
      console.error(`❌ Google Drive upload failed for ${upload.uploadId}:`, err.message);
      
      // Save error state
      const errorUpload = await Upload.findById(upload._id);
      if (errorUpload) {
        errorUpload.stage = 'error';
        errorUpload.error = `Drive upload failed: ${err.message}`;
        errorUpload.isActive = false;
        await errorUpload.save();
      }
      return;
    }

    // Clear progress interval
    if (progressUpdateInterval) {
      clearInterval(progressUpdateInterval);
    }

    // Mark as complete
    const completeUpload = await Upload.findById(upload._id);
    if (completeUpload) {
      completeUpload.stage = 'done';
      completeUpload.progress = 100;
      completeUpload.googleFileId = fileId;
      completeUpload.isActive = false;
      await completeUpload.save();
      console.log(`✅ Upload completed: ${upload.uploadId} -> ${fileId}`);
    }

  } catch (error) {
    // Clean up interval if error
    if (progressUpdateInterval) {
      clearInterval(progressUpdateInterval);
    }
    
    console.error(`❌ Upload processing failed for ${upload.uploadId}:`, error.message);
    
    // Final error save
    if (!isSaving) {
      try {
        const errorUpload = await Upload.findById(upload._id);
        if (errorUpload) {
          errorUpload.stage = 'error';
          errorUpload.error = error.message;
          errorUpload.isActive = false;
          await errorUpload.save();
        }
      } catch (saveErr) {
        console.error('Failed to save final error state:', saveErr.message);
      }
    }
  }
}

module.exports = router;