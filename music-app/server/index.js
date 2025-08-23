const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const ytdl = require('@distube/ytdl-core');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- Runtime env validation ---
const REQUIRED_ENV = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('Missing env vars:', missing.join(', '));
  process.exit(1);
}

// --- Constants & helpers ---
const YOUTUBE_REGEX = /yout.*https|https.*yout/i;
const FOLDER_NAME = 'Music Player';
function sanitizeFileName(name='') {return name.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').replace(/\s+/g,' ').trim().slice(0,150);} 

const app = express();
const PORT = process.env.PORT || 8000;

// CORS configuration - IMPORTANT: Must be before routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://your-domain.com' // Add your production domain here
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(bodyParser.json());

// --- Basic in-memory rate limiter (IP based) ---
const rateWindowMs = 60_000; // 1 min
const maxReqPerWindow = 120;
const ipHits = new Map();
app.use((req,res,next)=>{
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = ipHits.get(ip) || [];
  // remove old
  while (bucket.length && (now - bucket[0]) > rateWindowMs) bucket.shift();
  bucket.push(now);
  ipHits.set(ip, bucket);
  if (bucket.length > maxReqPerWindow) return res.status(429).json({ message: 'Rate limit exceeded' });
  next();
});

// --- Simple CSRF header check placeholder for state-changing requests ---
app.use((req,res,next)=>{
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    // Expect a custom header e.g. x-csrf-token (frontend can set a static token for now or future enhancement)
    // if (!req.headers['x-csrf-token']) return res.status(400).json({ message: 'Missing CSRF token' });
  }
  next();
});

const driveScopes = [ 'https://www.googleapis.com/auth/drive.file' ];

// Store folder ID persistently
const FOLDER_FILE = path.join(__dirname, 'folder.json');

function loadFolderId() {
  try {
    if (fs.existsSync(FOLDER_FILE)) {
      const data = JSON.parse(fs.readFileSync(FOLDER_FILE, 'utf8'));
      return data.folderId;
    }
  } catch (error) {
    console.error('Error loading folder ID:', error);
  }
  return null;
}

function saveFolderId(folderId) {
  try {
    fs.writeFileSync(FOLDER_FILE, JSON.stringify({ folderId }, null, 2));
  } catch (error) {
    console.error('Error saving folder ID:', error);
  }
}
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const TOKEN_FILE = path.join(__dirname, 'tokens.json');
let userTokens = null;
let musicFolderId = null; // Store the Music Player folder ID

// Load folder ID on startup
musicFolderId = loadFolderId();

// Fix for spaces in path - set binary location explicitly
const ytDlpPath = path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');

function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      oauth2Client.setCredentials(tokens);
      return tokens;
    }
  } catch (error) {
    console.error('Error loading tokens:', error);
  }
  return null;
}

function saveTokens(tokens) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

// Create or get the Music Player folder - STRICT FOLDER ONLY ACCESS
async function ensureMusicFolder() {
  if (musicFolderId) {
    // Verify folder still exists
    try {
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      await drive.files.get({ fileId: musicFolderId });
      return musicFolderId;
    } catch (error) {
      musicFolderId = null;
    }
  }
  
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Create new Music Player folder
    const folderMetadata = {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Dedicated folder for Music Player app - contains only music files'
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name',
    });

    musicFolderId = folder.data.id;
    saveFolderId(musicFolderId); // Persist folder ID
    return musicFolderId;
    
  } catch (error) {
    console.error('Error creating Music folder:', error);
    throw new Error('Failed to create Music Player folder');
  }
}

userTokens = loadTokens();

// --- OAuth 2.0 Endpoints ---
app.get('/auth/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: driveScopes,
    prompt: 'consent'
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    userTokens = tokens;
    saveTokens(tokens);
    
    // Redirect back to the Next.js app with success parameter
    const redirectUrl = process.env.NODE_ENV === 'production' 
      ? 'https://yourdomain.com?auth=success' 
      : 'http://localhost:3000?auth=success';
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = process.env.NODE_ENV === 'production' 
      ? 'https://yourdomain.com?auth=error' 
      : 'http://localhost:3000?auth=error';
    res.redirect(redirectUrl);
  }
});

// --- API Endpoints ---
// app.post('/api/download-and-upload', async (req, res) => {
//   const { youtubeUrl, fileName } = req.body;
  
//   if (!userTokens) {
//     return res.status(401).json({ 
//       message: 'Authentication required. Please authenticate first.',
//       authUrl: '/auth/google'
//     });
//   }

//   if (!youtubeUrl) {
//     return res.status(400).json({ 
//       message: 'Please provide a valid YouTube URL.' 
//     });
//   }

//   try {
//     console.log(' Processing YouTube URL:', youtubeUrl);

//     const tempDir = path.join(__dirname, 'temp');
//     if (!fs.existsSync(tempDir)) {
//       fs.mkdirSync(tempDir);
//     }

//     console.log(' Getting video information...');
//     const info = await youtubedl(youtubeUrl, {
//       dumpSingleJson: true,
//       noWarnings: true,
//       noCallHome: true,
//       noCheckCertificates: true,
//       preferFreeFormats: true,
//     }, {
//       binaryPath: ytDlpPath
//     });

//     const videoTitle = info.title || 'Unknown Title';
//     const sanitizedTitle = videoTitle.replace(/[<>:"/\\|?*]/g, '_');
//     const finalFileName = `${fileName || sanitizedTitle}`;
//     const outputPath = path.join(tempDir, finalFileName);

//     console.log(` Video found: "${videoTitle}"`);
//     console.log(' Downloading audio...');

//     await youtubedl(youtubeUrl, {
//       format: 'bestaudio',
//       output: outputPath + '.%(ext)s',
//       noWarnings: true,
//       noCallHome: true,
//       noCheckCertificates: true,
//       preferFreeFormats: true,
//     }, {
//       binaryPath: ytDlpPath
//     });

//     const files = fs.readdirSync(tempDir).filter(file => 
//       file.startsWith(path.basename(outputPath))
//     );

//     if (files.length === 0) {
//       return res.status(500).json({ 
//         message: 'Download completed but file not found. Please try again.' 
//       });
//     }

//     const downloadedFile = path.join(tempDir, files[0]);
//     const finalFileExtension = path.extname(files[0]);
//     const finalFileNameWithExt = finalFileName + finalFileExtension;
    
//     console.log(' Audio downloaded successfully:', files[0]);
//     console.log(' Uploading to Google Drive Music Player folder...');

//     // STRICT: Must upload to Music Player folder only
//     const folderId = await ensureMusicFolder();
    
//     if (!folderId) {
//       throw new Error('Failed to access Music Player folder');
//     }

//     const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
//     const uploadResponse = await drive.files.create({
//       requestBody: {
//         name: finalFileNameWithExt,
//         mimeType: 'audio/webm',
//         parents: [folderId], // MUST be in Music Player folder
//         description: 'Music file uploaded by Music Player app'
//       },
//       media: {
//         mimeType: 'audio/webm',
//         body: fs.createReadStream(downloadedFile),
//       },
//     });

//     fs.unlinkSync(downloadedFile);
//     console.log(' Upload successful, file ID:', uploadResponse.data.id);

//     res.status(200).json({ 
//       message: 'File uploaded to Google Drive successfully!', 
//       fileName: finalFileNameWithExt,
//       videoTitle: videoTitle,
//       fileId: uploadResponse.data.id
//     });

//   } catch (error) {
//     console.error(' Error in download-and-upload:', error);

//     // Cleanup
//     try {
//       const tempDir = path.join(__dirname, 'temp');
//       if (fs.existsSync(tempDir)) {
//         const files = fs.readdirSync(tempDir);
//         files.forEach(file => {
//           try {
//             fs.unlinkSync(path.join(tempDir, file));
//           } catch (e) {}
//         });
//       }
//     } catch (cleanupError) {}

//     if (error.message && error.message.includes('Video unavailable')) {
//       res.status(400).json({ 
//         message: 'This video is unavailable. It might be private, deleted, or region-restricted.' 
//       });
//     } else if (error.code === 401) {
//       userTokens = null;
//       if (fs.existsSync(TOKEN_FILE)) {
//         fs.unlinkSync(TOKEN_FILE);
//       }
//       res.status(401).json({
//         message: 'Authentication expired. Please re-authenticate.',
//         authUrl: '/auth/google'
//       });
//     } else {
//       res.status(500).json({ 
//         message: 'Download failed. Please check the URL and try again.' 
//       });
//     }
//   }
// });
// app.post('/api/download-and-upload', async (req, res) => {
//   const { youtubeUrl, fileName } = req.body;

//   if (!userTokens) {
//     return res.status(401).json({
//       message: 'Authentication required. Please authenticate first.',
//       authUrl: '/auth/google'
//     });
//   }

//   if (!youtubeUrl || !ytdl.validateURL(youtubeUrl)) {
//     return res.status(400).json({ message: 'Invalid YouTube URL' });
//   }

//   try {
//     console.log(' Streaming YouTube URL to Google Drive:', youtubeUrl);

//     // Get video info (for title)
//     const info = await ytdl.getInfo(youtubeUrl);
//     const videoTitle = info.videoDetails.title || 'Unknown Title';
//     const sanitizedTitle = (fileName || videoTitle)
//       .replace(/[<>:"/\\|?*]/g, '_')
//       .trim()
//       .slice(0, 150);

//     // Ensure Music folder exists
//     const folderId = await ensureMusicFolder();

//     // Prepare Google Drive API
//     const drive = google.drive({ version: 'v3', auth: oauth2Client });

//     // Stream YouTube audio directly to Google Drive
//     const ytdlStream = ytdl.downloadFromInfo(info, {
//       quality: 'highestaudio',
//       filter: 'audioonly',
//     });

//     const response = await drive.files.create({
//       requestBody: {
//         name: sanitizedTitle + '.webm',
//         mimeType: 'audio/webm',
//         parents: [folderId],
//       },
//       media: {
//         mimeType: 'audio/webm',
//         body: ytdlStream,
//       },
//     });

//     console.log('Upload successful:', response.data.id);

//     res.status(200).json({
//       message: 'File uploaded successfully to Google Drive',
//       fileId: response.data.id,
//       videoTitle: videoTitle,
//       fileName: sanitizedTitle + '.webm'
//     });

//   } catch (error) {
//     console.error('Error streaming video to Drive:', error);
//     res.status(500).json({ message: 'Failed to process video upload' });
//   }
// });

// const ytDlpPath = path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');

function normalizeYoutubeUrl(url) {
  if (!url) return url;
  const match = url.match(/(?:youtu\.be\/|v=|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : url;
}

function streamWithYtDlp(url, onProgress) {
  const args = ['-f','bestaudio','-o','-','--no-playlist',url];
  const proc = spawn(ytDlpPath, args);
  proc.stderr.on('data', chunk => {
    const txt = chunk.toString();
    const m = txt.match(/(\d{1,3}\.\d)%/);
    if (m && onProgress) {
      const pct = Math.min(100, Math.floor(parseFloat(m[1])));
      onProgress(pct);
    }
  });
  return proc.stdout;
}

app.post('/api/download-and-upload', async (req, res) => {
  const { youtubeUrl, fileName } = req.body;
  const uploadId = crypto.randomUUID();

  if (!userTokens) {
    return res.status(401).json({ message: 'Authentication required', authUrl: '/auth/google' });
  }
  if (!youtubeUrl || !YOUTUBE_REGEX.test(youtubeUrl)) {
    return res.status(400).json({ message: 'Invalid YouTube URL' });
  }

  uploadsProgress[uploadId] = { progress: 0, stage: 'starting' };
  uploadControllers[uploadId] = { stream: null, aborted: false };

  // Try to fetch video info BEFORE responding so client can show title optimistically
  let preInfo = null; let safeName = null; let videoTitle = null;
  try {
    const norm = normalizeYoutubeUrl(youtubeUrl);
    preInfo = await ytdl.getInfo(norm);
    videoTitle = preInfo.videoDetails.title || 'Untitled';
    safeName = sanitizeFileName(fileName || videoTitle) + '.webm';
  } catch {
    videoTitle = 'Processing';
    safeName = sanitizeFileName(fileName || 'Processing') + '.webm';
  }
  res.status(200).json({ uploadId, fileName: safeName, videoTitle });

  (async () => {
    try {
  const normalizedUrl = normalizeYoutubeUrl(youtubeUrl);
  let info = preInfo, ytdlStream;

      try {
  info = await ytdl.getInfo(normalizedUrl);
  ytdlStream = ytdl.downloadFromInfo(info, { quality: 'highestaudio', filter: 'audioonly', highWaterMark: 1<<25 });
        ytdlStream.on('progress', (_, downloaded, total) => {
          uploadsProgress[uploadId] = {
            progress: Math.min(99, Math.floor((downloaded / total) * 100)),
            stage: 'downloading'
          };
        });
      } catch {
        console.warn('Fallback to yt-dlp');
        ytdlStream = streamWithYtDlp(normalizedUrl, pct => {
          uploadsProgress[uploadId] = { progress: Math.min(99, pct), stage: 'downloading' };
        });
      }

  const folderId = await ensureMusicFolder();
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  uploadControllers[uploadId].stream = ytdlStream;

  uploadsProgress[uploadId] = { progress: 0, stage: 'uploading' };

      // Upload to Google Drive
      const safeName = sanitizeFileName(fileName || (info ? info.videoDetails.title : 'Untitled')) || 'Untitled';
      await drive.files.create({
        requestBody: {
          name: safeName + '.webm',
          mimeType: 'audio/webm',
          parents: [folderId],
          description: 'Uploaded via Music Player app'
        },
        media: { mimeType: 'audio/webm', body: ytdlStream },
      });

      uploadsProgress[uploadId] = { progress: 100, stage: 'done' };

      // Auto-clear after 30s
      setTimeout(() => delete uploadsProgress[uploadId], 30000);

    } catch (err) {
      console.error('Upload failed:', err);
      if (uploadControllers[uploadId]?.aborted) {
        uploadsProgress[uploadId] = { progress: 0, stage: 'canceled' };
      } else {
        uploadsProgress[uploadId] = { progress: 0, stage: 'error' };
      }
    }
  })();
});

// Cancel upload endpoint
app.post('/api/upload/:uploadId/cancel', (req, res) => {
  const { uploadId } = req.params;
  const ctl = uploadControllers[uploadId];
  if (!ctl) return res.status(404).json({ message: 'Upload not found' });
  try {
    ctl.aborted = true;
    if (ctl.stream && !ctl.stream.destroyed) ctl.stream.destroy(new Error('Canceled'));
    uploadsProgress[uploadId] = { progress: uploadsProgress[uploadId]?.progress || 0, stage: 'canceled' };
    setTimeout(() => { delete uploadsProgress[uploadId]; delete uploadControllers[uploadId]; }, 10000);
    res.json({ message: 'Canceled' });
  } catch (e) {
    res.status(500).json({ message: 'Cancellation failed' });
  }
});


const uploadsProgress = {}; // { uploadId: { progress, stage } }
const uploadControllers = {}; // { uploadId: { stream, aborted } }

// SSE endpoint
app.get('/api/progress/:uploadId', (req, res) => {
  const uploadId = req.params.uploadId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const interval = setInterval(() => {
    const progress = uploadsProgress[uploadId] || { progress: 0, stage: 'starting' };
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
  }, 1000);

  req.on('close', () => clearInterval(interval));
});



app.get('/api/songs', async (req, res) => {
  if (!userTokens) {
    return res.status(401).json({
      message: 'Authentication required.',
      authUrl: '/auth/google'
    });
  }

  try {
    // STRICT: Only get files from Music Player folder
    const folderId = await ensureMusicFolder();
    
    if (!folderId) {
      return res.status(500).json({ 
        message: 'Music Player folder not accessible.' 
      });
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // ONLY get files that are:
    // 1. In the Music Player folder
    // 2. Audio files
    // 3. Not trashed
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'audio/' and trashed=false`,
      fields: 'files(id, name, webContentLink, createdTime, size)',
      orderBy: 'createdTime desc'
    });
    res.status(200).json(response.data.files);
    
  } catch (error) {
    console.error('Error fetching songs from Music Player folder:', error);
    
    if (error.code === 401) {
      userTokens = null;
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
      res.status(401).json({
        message: 'Authentication expired. Please re-authenticate.',
        authUrl: '/auth/google'
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to retrieve songs from Music Player folder.' 
      });
    }
  }
});

app.get('/api/stream/:fileId', async (req, res) => {
  if (!userTokens) {
    return res.status(401).json({
      message: 'Authentication required.',
      authUrl: '/auth/google'
    });
  }

  const { fileId } = req.params;
  
  try {
    // SECURITY CHECK: Verify file is in Music Player folder
    const folderId = await ensureMusicFolder();
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // First check if file exists and is in our Music Player folder
    const fileInfo = await drive.files.get({
      fileId,
      fields: 'id, name, parents, mimeType'
    });

    // Verify file is in Music Player folder
    if (!fileInfo.data.parents || !fileInfo.data.parents.includes(folderId)) {
      return res.status(403).send('Access denied: File not in Music Player folder.');
    }

    // Verify it's an audio file
    if (!fileInfo.data.mimeType.includes('audio')) {
      return res.status(403).send('Access denied: Not an audio file.');
    }


    // Range / full streaming
    const meta = await drive.files.get({ fileId, fields: 'size, mimeType' });
    const size = parseInt(meta.data.size, 10);
    const mime = meta.data.mimeType || 'audio/webm';
    const range = req.headers.range;
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      if (!m) return res.status(416).end();
      let start = m[1] ? parseInt(m[1],10) : 0;
      let end = m[2] ? parseInt(m[2],10) : size - 1;
      if (isNaN(start) || isNaN(end) || start > end || end >= size) return res.status(416).end();
      const chunkSize = end - start + 1;
      const partial = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream', headers: { Range: `bytes=${start}-${end}` } });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=3600'
      });
      partial.data.on('error', e => { console.error('Partial stream error', e); if (!res.headersSent) res.end(); });
      partial.data.pipe(res);
    } else {
      const full = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
      res.writeHead(200, {
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=3600'
      });
      full.data.on('error', e => { console.error('Full stream error', e); if (!res.headersSent) res.end(); });
      full.data.pipe(res);
    }
    
  } catch (error) {
    console.error('Error streaming file:', error);
    
    if (error.code === 401) {
      userTokens = null;
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
      res.status(401).json({
        message: 'Authentication expired. Please re-authenticate.',
        authUrl: '/auth/google'
      });
    } else if (error.code === 404) {
      res.status(404).send('File not found or not accessible.');
    } else if (error.code === 403) {
      res.status(403).send('Access denied: File not in Music Player folder.');
    } else {
      res.status(500).send('Could not stream the file.');
    }
  }
});

app.get('/api/auth/status', async (req, res) => {
  if (!userTokens) {
    return res.json({ 
      authenticated: false,
      downloader: 'youtube-dl-exec'
    });
  }

  try {
    const folderId = musicFolderId || await ensureMusicFolder();
    res.json({ 
      authenticated: !!userTokens,
      downloader: 'youtube-dl-exec',
      musicFolderId: folderId,
  folderName: FOLDER_NAME,
      securityMode: 'STRICT - Only Music Player folder access'
    });
  } catch (error) {
    res.json({ 
      authenticated: !!userTokens,
      downloader: 'youtube-dl-exec',
      error: 'Could not access Music Player folder',
      securityMode: 'STRICT - Only Music Player folder access'
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal server error' });
});

process.on('unhandledRejection', e => console.error('UnhandledRejection', e));
process.on('uncaughtException', e => console.error('UncaughtException', e));

app.listen(PORT, () => {
  console.log(` Server is running on http://localhost:${PORT}`);
  
  if (!userTokens) {
    console.log(`Authentication required: http://localhost:${PORT}/auth/google`);
  }
});