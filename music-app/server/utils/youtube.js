// /utils/youtube.js - Corrected for Render deployment
const ytdl = require('@distube/ytdl-core');
const youtubedl = require('youtube-dl-exec');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');

// --- CONSTANTS ---
const YOUTUBE_REGEX = /yout.*https|https.*yout/i;
// This is the fixed path to your secret file on Render.
const COOKIE_FILE_PATH = '/etc/secrets/cookies.txt';

// --- HELPER FUNCTIONS ---
function sanitizeFileName(name = '') {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150);
}

function normalizeYoutubeUrl(url) {
  if (!url) return url;
  const match = url.match(/(?:youtu\.be\/|v=|shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/watch?v=${match[1]}` : url;
}

function isValidYouTubeUrl(url) {
  return YOUTUBE_REGEX.test(url);
}

// --- DOWNLOAD METHODS ---

// Method 1: Using youtube-dl-exec (Primary Method)
async function streamWithYoutubeDlExec(url, onProgress) {
  try {
    console.log('🎵 Attempting download with youtube-dl-exec (with cookies)...');
    
    const outputStream = new PassThrough();
    
    // Simplified options that directly use the secret cookie file
    const options = {
      extractAudio: true,
      audioFormat: 'best',
      noCheckCertificate: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ['user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'],
      quiet: true,
      output: '-',
      // We directly specify the cookie file path. No more 'cookiesFromBrowser'.
      cookies: COOKIE_FILE_PATH,
    };

    const childProcess = youtubedl.exec(url, options);

    childProcess.stdout.pipe(outputStream);

    // Optional: You can try to parse progress from stderr if needed
    childProcess.stderr.on('data', (data) => {
        // console.log(`stderr: ${data}`); // Uncomment for debugging
    });

    childProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`youtube-dl-exec process exited with code ${code}`);
      }
    });

    if (onProgress) onProgress(100); // Placeholder for progress

    return outputStream;
  } catch (error) {
    console.error('❌ youtube-dl-exec failed:', error.message);
    throw error;
  }
}

// Method 2: Using ytdl-core (Fallback Method)
// This method is less reliable as it's more easily blocked by YouTube.
async function streamWithYtdlCore(url, onProgress) {
  try {
    console.log('🎵 Attempting download with ytdl-core...');
    
    const normalizedUrl = normalizeYoutubeUrl(url);
    
    const options = {
      quality: 'highestaudio',
      filter: 'audioonly',
      highWaterMark: 1 << 25,
    };

    const stream = ytdl(normalizedUrl, options);
    const outputStream = new PassThrough();
    stream.pipe(outputStream);
    
    if (onProgress) {
      stream.on('progress', (_, downloaded, total) => {
        const percent = Math.min(99, Math.floor((downloaded / total) * 100));
        onProgress(percent);
      });
    }
    
    return outputStream;
  } catch (error) {
    console.error('❌ ytdl-core failed:', error.message);
    throw error;
  }
}

// --- MAIN EXPORTED FUNCTIONS ---

async function getVideoInfo(url) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  try {
    const options = {
      dumpSingleJson: true,
      noCheckCertificate: true,
      noWarnings: true,
      addHeader: ['user-agent:Mozilla/5.0'],
      // We also use the cookie file for getting info
      cookies: COOKIE_FILE_PATH,
    };
    
    const info = await youtubedl(normalizedUrl, options);
    return {
      title: info.title || 'Unknown Title',
      duration: info.duration,
      thumbnail: info.thumbnail
    };
  } catch (error) {
    console.warn('⚠️ Video info method failed:', error.message);
    // Fallback to a default object if info retrieval fails
    return {
        title: 'Unknown Title',
        duration: null,
        thumbnail: null
    };
  }
}

async function createAudioStream(url, onProgress) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  
  // Define download methods. We prioritize youtube-dl-exec as it's more robust with cookies.
  const methods = [
    { name: 'youtube-dl-exec', func: () => streamWithYoutubeDlExec(normalizedUrl, onProgress) },
    { name: 'ytdl-core', func: () => streamWithYtdlCore(normalizedUrl, onProgress) }
  ];

  let lastError = null;
  
  for (const method of methods) {
    try {
      console.log(`🔄 Trying ${method.name}...`);
      const stream = await method.func();
      if (stream) {
        console.log(`✅ Successfully created stream with ${method.name}`);
        return { stream, info: null };
      }
    } catch (error) {
      console.error(`❌ ${method.name} failed:`, error.message);
      lastError = error;
      continue;
    }
  }

  console.error('❌ All download methods failed');
  throw lastError || new Error('All download methods failed. YouTube may be blocking access.');
}

module.exports = {
  sanitizeFileName,
  normalizeYoutubeUrl,
  isValidYouTubeUrl,
  getVideoInfo,
  createAudioStream,
  YOUTUBE_REGEX
};