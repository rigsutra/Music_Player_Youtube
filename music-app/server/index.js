const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const youtubedl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

const driveScopes = [
  'https://www.googleapis.com/auth/drive.file' // Only files created by the app
];

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
    console.log('📁 Folder ID saved');
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
      console.log('🔐 Tokens loaded from file');
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
    console.log('💾 Tokens saved to file');
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
      console.log('📁 Using existing Music Player folder:', musicFolderId);
      return musicFolderId;
    } catch (error) {
      console.log('📁 Stored folder ID invalid, creating new one...');
      musicFolderId = null;
    }
  }
  
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Create new Music Player folder
    const folderMetadata = {
      name: 'Music Player',
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Dedicated folder for Music Player app - contains only music files'
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, name',
    });

    musicFolderId = folder.data.id;
    saveFolderId(musicFolderId); // Persist folder ID
    console.log('📁 Created Music Player folder:', musicFolderId);
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
app.post('/api/download-and-upload', async (req, res) => {
  const { youtubeUrl, fileName } = req.body;
  
  if (!userTokens) {
    return res.status(401).json({ 
      message: 'Authentication required. Please authenticate first.',
      authUrl: '/auth/google'
    });
  }

  if (!youtubeUrl) {
    return res.status(400).json({ 
      message: 'Please provide a valid YouTube URL.' 
    });
  }

  try {
    console.log('🎵 Processing YouTube URL:', youtubeUrl);

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    console.log('ℹ️  Getting video information...');
    const info = await youtubedl(youtubeUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
    }, {
      binaryPath: ytDlpPath
    });

    const videoTitle = info.title || 'Unknown Title';
    const sanitizedTitle = videoTitle.replace(/[<>:"/\\|?*]/g, '_');
    const finalFileName = `${fileName || sanitizedTitle}`;
    const outputPath = path.join(tempDir, finalFileName);

    console.log(`✅ Video found: "${videoTitle}"`);
    console.log('⬇️  Downloading audio...');

    await youtubedl(youtubeUrl, {
      format: 'bestaudio',
      output: outputPath + '.%(ext)s',
      noWarnings: true,
      noCallHome: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
    }, {
      binaryPath: ytDlpPath
    });

    const files = fs.readdirSync(tempDir).filter(file => 
      file.startsWith(path.basename(outputPath))
    );

    if (files.length === 0) {
      return res.status(500).json({ 
        message: 'Download completed but file not found. Please try again.' 
      });
    }

    const downloadedFile = path.join(tempDir, files[0]);
    const finalFileExtension = path.extname(files[0]);
    const finalFileNameWithExt = finalFileName + finalFileExtension;
    
    console.log('✅ Audio downloaded successfully:', files[0]);
    console.log('☁️  Uploading to Google Drive Music Player folder...');

    // STRICT: Must upload to Music Player folder only
    const folderId = await ensureMusicFolder();
    
    if (!folderId) {
      throw new Error('Failed to access Music Player folder');
    }

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: finalFileNameWithExt,
        mimeType: 'audio/webm',
        parents: [folderId], // MUST be in Music Player folder
        description: 'Music file uploaded by Music Player app'
      },
      media: {
        mimeType: 'audio/webm',
        body: fs.createReadStream(downloadedFile),
      },
    });

    fs.unlinkSync(downloadedFile);
    console.log('🎉 Upload successful, file ID:', uploadResponse.data.id);

    res.status(200).json({ 
      message: 'File uploaded to Google Drive successfully!', 
      fileName: finalFileNameWithExt,
      videoTitle: videoTitle,
      fileId: uploadResponse.data.id
    });

  } catch (error) {
    console.error('❌ Error in download-and-upload:', error);

    // Cleanup
    try {
      const tempDir = path.join(__dirname, 'temp');
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {}
        });
      }
    } catch (cleanupError) {}

    if (error.message && error.message.includes('Video unavailable')) {
      res.status(400).json({ 
        message: 'This video is unavailable. It might be private, deleted, or region-restricted.' 
      });
    } else if (error.code === 401) {
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
        message: 'Download failed. Please check the URL and try again.' 
      });
    }
  }
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

    console.log(`🎵 Found ${response.data.files.length} songs in Music Player folder ONLY`);
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
      console.log('🚫 Attempted access to file outside Music Player folder');
      return res.status(403).send('Access denied: File not in Music Player folder.');
    }

    // Verify it's an audio file
    if (!fileInfo.data.mimeType.includes('audio')) {
      return res.status(403).send('Access denied: Not an audio file.');
    }

    console.log('✅ Streaming authorized file from Music Player folder:', fileInfo.data.name);

    // Stream the file
    const response = await drive.files.get({
      fileId,
      alt: 'media',
    }, { responseType: 'stream' });

    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    response.data.pipe(res);
    
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
      folderName: 'Music Player',
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

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🎵 Using youtube-dl-exec for reliable downloads`);
  
  if (!userTokens) {
    console.log(`🔐 Authentication required: http://localhost:${PORT}/auth/google`);
  }
});