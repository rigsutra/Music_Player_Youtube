// /utils/youtube.js - Final version that works with Render's read-only cookies
const ytdl = require('@distube/ytdl-core');
const youtubedl = require('youtube-dl-exec');
const { spawn } = require('child_process');
const { PassThrough, Transform } = require('stream');
const fs = require('fs');
const path = require('path');

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

// Copy read-only cookies to a writable temporary location
async function getWritableCookiePath() {
  const readOnlyCookie = '/etc/secrets/cookies.txt';
  
  // If the file doesn't exist, return null
  if (!fs.existsSync(readOnlyCookie)) {
    return null;
  }
  
  // Create a temp directory in /tmp (always writable on Render)
  const tmpDir = '/tmp/yt-cookies';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  const tempCookieFile = path.join(tmpDir, 'cookies.txt');
  
  // Copy the read-only cookie to the temp location
  try {
    fs.copyFileSync(readOnlyCookie, tempCookieFile);
    // Make it writable
    fs.chmodSync(tempCookieFile, 0o666);
    console.log('📝 Copied cookies to writable location:', tempCookieFile);
    return tempCookieFile;
  } catch (err) {
    console.warn('⚠️ Could not copy cookies:', err.message);
    // If copy fails, try to use the read-only file directly
    return readOnlyCookie;
  }
}

// Method 1: Using youtube-dl-exec with writable cookie copy
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
      output: '-',
    };

    // Get writable cookie path
    const cookiePath = await getWritableCookiePath();
    if (cookiePath) {
      options.cookies = cookiePath;
      console.log('🍪 Using cookies from:', cookiePath);
    } else {
      console.log('🍪 No cookies available, proceeding without');
    }

    // Execute yt-dlp
    const subprocess = youtubedl.exec(url, options);
    
    // Pipe stdout directly to output stream
    subprocess.stdout.pipe(outputStream);
    
    // Track progress from stderr
    let lastProgress = 0;
    subprocess.stderr.on('data', (data) => {
      const text = data.toString();
      
      // Ignore cookie write errors
      if (text.includes('OSError') || text.includes('Read-only file system')) {
        return; // Ignore these errors
      }
      
      // Extract progress
      const match = text.match(/(\d+(?:\.\d+)?%)/);
      if (match && onProgress) {
        const percent = Math.floor(parseFloat(match[1]));
        if (percent > lastProgress) {
          lastProgress = percent;
          onProgress(percent);
        }
      }
    });

    subprocess.on('error', (err) => {
      if (!err.message.includes('cookies')) {
        console.error('Process error:', err.message);
        outputStream.destroy(err);
      }
    });

    subprocess.on('exit', (code) => {
      // Exit code 1 is OK if we got data (happens with cookie write errors)
      if (code === 0) {
        console.log('✅ Download completed successfully');
      } else if (code === 1) {
        console.log('⚠️ Download completed with warnings (likely cookie write error)');
      } else if (code > 1) {
        console.error(`❌ yt-dlp exited with code ${code}`);
      }
    });

    return outputStream;
  } catch (error) {
    console.error('❌ youtube-dl-exec failed:', error.message);
    throw error;
  }
}

// Method 2: System yt-dlp fallback
function streamWithSystemYtDlp(url, onProgress) {
  return new Promise(async (resolve, reject) => {
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

    // Add cookies if available
    const cookiePath = await getWritableCookiePath();
    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }

    const commands = ['yt-dlp', 'youtube-dl'];
    
    for (const cmd of commands) {
      try {
        const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        console.log(`✅ Found ${cmd}`);
        
        proc.stdout.pipe(outputStream);
        
        proc.stderr.on('data', (chunk) => {
          const text = chunk.toString();
          if (!text.includes('OSError')) {
            const match = text.match(/(\d+(?:\.\d+)?%)/);
            if (match && onProgress) {
              onProgress(Math.floor(parseFloat(match[1])));
            }
          }
        });

        proc.on('close', (code) => {
          if (code === 0 || code === 1) {
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

// Method 3: ytdl-core (no cookies needed)
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
  
  try {
    const options = {
      dumpSingleJson: true,
      noCheckCertificate: true,
      noWarnings: true,
      addHeader: ['user-agent:Mozilla/5.0'],
    };
    
    // Use writable cookie copy
    const cookiePath = await getWritableCookiePath();
    if (cookiePath) {
      options.cookies = cookiePath;
    }
    
    const info = await youtubedl(normalizedUrl, options);
    return {
      title: info.title || 'Unknown Title',
      duration: info.duration,
      thumbnail: info.thumbnail
    };
  } catch (error) {
    console.warn('⚠️ Video info failed, using defaults:', error.message.split('\n')[0]);
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