// /utils/youtube.js - Works without cookies, handles errors gracefully
const ytdl = require('@distube/ytdl-core');
const youtubedl = require('youtube-dl-exec');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const fs = require('fs');

const YOUTUBE_REGEX = /yout.*https|https.*yout/i;

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

// Method 1: Using youtube-dl-exec without requiring cookies
async function streamWithYoutubeDlExec(url, onProgress) {
  try {
    console.log('🎵 Attempting download with youtube-dl-exec...');
    
    const outputStream = new PassThrough();
    
    const options = {
      extractAudio: true,
      audioFormat: 'best',
      noCheckCertificate: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ['user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'],
      quiet: false, // Show output for debugging
      output: '-',
    };

    // Only add cookies if the file actually exists
    const cookiePath = process.env.YOUTUBE_COOKIES_FILE || '/etc/secrets/cookies.txt';
    if (fs.existsSync(cookiePath)) {
      console.log('📪 Found cookies file:', cookiePath);
      options.cookies = cookiePath;
    } else {
      console.log('🍪 No cookies file found, proceeding without cookies');
      // Try browser cookies as fallback
      options.cookiesFromBrowser = 'chrome';
    }

    // Use exec to get the stream properly
    const subprocess = youtubedl.exec(url, options);
    
    // Pipe stdout to our stream
    subprocess.stdout.pipe(outputStream);
    
    // Handle errors
    subprocess.stderr.on('data', (data) => {
      const text = data.toString();
      // Check for progress
      const match = text.match(/(\d+(?:\.\d+)?%)/);
      if (match && onProgress) {
        const percent = parseFloat(match[1]);
        onProgress(Math.floor(percent));
      }
    });

    subprocess.on('error', (err) => {
      console.error('youtube-dl-exec process error:', err);
      outputStream.destroy(err);
    });

    subprocess.on('exit', (code) => {
      if (code === 0) {
        if (onProgress) onProgress(100);
      } else {
        console.error(`youtube-dl-exec exited with code ${code}`);
      }
    });

    return outputStream;
  } catch (error) {
    console.error('❌ youtube-dl-exec failed:', error.message);
    throw error;
  }
}

// Method 2: Using system yt-dlp
function streamWithSystemYtDlp(url, onProgress) {
  return new Promise((resolve, reject) => {
    console.log('🎵 Attempting download with system yt-dlp...');
    
    const outputStream = new PassThrough();
    const args = [
      '-f', 'bestaudio',
      '-o', '-',
      '--no-playlist',
      '--no-check-certificate',
      '--user-agent', 'Mozilla/5.0',
      url
    ];

    // Try to add cookies if available
    const cookiePath = process.env.YOUTUBE_COOKIES_FILE || '/etc/secrets/cookies.txt';
    if (fs.existsSync(cookiePath)) {
      args.push('--cookies', cookiePath);
    }

    const commands = ['yt-dlp', 'youtube-dl'];
    let proc = null;
    
    for (const cmd of commands) {
      try {
        proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        console.log(`✅ Found ${cmd} in system`);
        
        proc.stdout.pipe(outputStream);
        
        proc.stderr.on('data', (chunk) => {
          const text = chunk.toString();
          const match = text.match(/(\d+(?:\.\d+)?%)/);
          if (match && onProgress) {
            onProgress(Math.floor(parseFloat(match[1])));
          }
        });

        proc.on('close', (code) => {
          if (code === 0) {
            resolve(outputStream);
          } else {
            reject(new Error(`${cmd} exited with code ${code}`));
          }
        });

        proc.on('error', reject);
        return;
      } catch (err) {
        continue;
      }
    }
    
    reject(new Error('No youtube downloader found'));
  });
}

// Method 3: ytdl-core fallback
async function streamWithYtdlCore(url, onProgress) {
  try {
    console.log('🎵 Attempting download with ytdl-core...');
    const normalizedUrl = normalizeYoutubeUrl(url);
    
    const stream = ytdl(normalizedUrl, {
      quality: 'highestaudio',
      filter: 'audioonly',
      highWaterMark: 1 << 25,
    });
    
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

async function getVideoInfo(url) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  
  // Try without cookies first
  try {
    const options = {
      dumpSingleJson: true,
      noCheckCertificate: true,
      noWarnings: true,
      addHeader: ['user-agent:Mozilla/5.0'],
    };
    
    // Only add cookies if file exists
    const cookiePath = process.env.YOUTUBE_COOKIES_FILE || '/etc/secrets/cookies.txt';
    if (fs.existsSync(cookiePath)) {
      options.cookies = cookiePath;
    }
    
    const info = await youtubedl(normalizedUrl, options);
    return {
      title: info.title || 'Unknown Title',
      duration: info.duration,
      thumbnail: info.thumbnail
    };
  } catch (error) {
    console.warn('⚠️ Video info method failed:', error.message);
    // Return defaults instead of crashing
    return {
      title: 'Unknown Title',
      duration: null,
      thumbnail: null
    };
  }
}

async function createAudioStream(url, onProgress) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  
  const methods = [
    { name: 'youtube-dl-exec', func: () => streamWithYoutubeDlExec(normalizedUrl, onProgress) },
    { name: 'system-ytdlp', func: () => streamWithSystemYtDlp(normalizedUrl, onProgress) },
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
    }
  }

  throw lastError || new Error('All download methods failed');
}

module.exports = {
  sanitizeFileName,
  normalizeYoutubeUrl,
  isValidYouTubeUrl,
  getVideoInfo,
  createAudioStream,
  YOUTUBE_REGEX
};