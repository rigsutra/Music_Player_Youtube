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
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const TOKEN_FILE = path.join(__dirname, 'tokens.json');
let userTokens = null;
let musicFolderId = null; // Store the Music Player folder ID

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

// Create or get the Music Player folder
async function ensureMusicFolder() {
  if (musicFolderId) return musicFolderId;
  
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // With drive.file scope, we can create folders but only see ones we created
    // Try to create the folder (it will return existing one if it exists)
    const folderMetadata = {
      name: 'Music Player',
      mimeType: 'application/vnd.google-apps.folder',
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
    });

    musicFolderId = folder.data.id;
    console.log('📁 Using/Created Music Player folder:', musicFolderId);
    return musicFolderId;
    
  } catch (error) {
    console.error('Error with Music folder:', error);
    // If folder creation fails, return null to upload to root
    return null;
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

  if (!youtubeUrl || !youtubeUrl.includes('youtube')) {
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
    console.log('☁️  Uploading to Google Drive...');

    // Ensure Music Player folder exists
    const folderId = await ensureMusicFolder();

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: finalFileNameWithExt,
        mimeType: 'audio/webm',
        ...(folderId && { parents: [folderId] }), // Upload to folder if it exists
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
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // With drive.file scope, we can only see files created by our app
    // This automatically provides security - we can't see other files
    const response = await drive.files.list({
      q: "mimeType contains 'audio/' and trashed=false",
      fields: 'files(id, name, webContentLink, createdTime, size)',
      orderBy: 'createdTime desc'
    });

    console.log(`🎵 Found ${response.data.files.length} songs created by this app`);
    res.status(200).json(response.data.files);
  } catch (error) {
    console.error('Error fetching songs:', error);
    
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
      res.status(500).json({ message: 'Failed to retrieve songs from Google Drive.' });
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
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  
  try {
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
      res.status(404).send('File not found.');
    } else {
      res.status(500).send('Could not stream the file.');
    }
  }
});

app.get('/api/auth/status', async (req, res) => {
  res.json({ 
    authenticated: !!userTokens,
    downloader: 'youtube-dl-exec',
    securityNote: 'Using drive.file scope - only app-created files are accessible'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🎵 Using youtube-dl-exec for reliable downloads`);
  
  if (!userTokens) {
    console.log(`🔐 Authentication required: http://localhost:${PORT}/auth/google`);
  }
});