// /utils/youtube.js - Updated with cookie support and stream fixes
const ytdl = require('@distube/ytdl-core');
const youtubedl = require('youtube-dl-exec');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { PassThrough } = require('stream');

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

// Method 1: Using youtube-dl-exec with cookies
async function streamWithYoutubeDlExec(url, onProgress) {
  try {
    console.log('🎵 Attempting download with youtube-dl-exec (with cookies)...');
    
    const outputStream = new PassThrough();
    
    const options = {
      extractAudio: true,
      audioFormat: 'best',
      noCheckCertificate: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ['user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'],
      quiet: true,
      output: '-',
      // Cookie options
      cookiesFromBrowser: 'chrome', // Try chrome, firefox, edge, safari
    };

    // If cookies file exists, use it
    if (process.env.YOUTUBE_COOKIES_FILE && fs.existsSync(process.env.YOUTUBE_COOKIES_FILE)) {
      options.cookies = process.env.YOUTUBE_COOKIES_FILE;
      delete options.cookiesFromBrowser;
      console.log('📪 Using cookies file:', process.env.YOUTUBE_COOKIES_FILE);
    }

    const output = await youtubedl(url, options);
    outputStream.end(output);
    if (onProgress) onProgress(100);
    
    return outputStream;
  } catch (error) {
    console.error('❌ youtube-dl-exec failed:', error.message);
    throw error;
  }
}

// Method 2: Using system yt-dlp with proper streaming
function streamWithSystemYtDlp(url, onProgress) {
  return new Promise((resolve, reject) => {
    console.log('🎵 Attempting download with system yt-dlp...');
    
    // Use PassThrough stream to avoid EOF issues
    const outputStream = new PassThrough();
    
    const args = [
      '-f', 'bestaudio',
      '-o', '-',
      '--no-playlist',
      '--no-check-certificate',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      // Add cookie options
      '--cookies-from-browser', 'chrome', // Try chrome, firefox, edge
      url
    ];

    // If cookies file exists, use it instead
    if (process.env.YOUTUBE_COOKIES_FILE && fs.existsSync(process.env.YOUTUBE_COOKIES_FILE)) {
      // Replace browser cookies with file
      const browserCookieIndex = args.indexOf('--cookies-from-browser');
      if (browserCookieIndex !== -1) {
        args.splice(browserCookieIndex, 2, '--cookies', process.env.YOUTUBE_COOKIES_FILE);
      }
      console.log('📪 Using cookies file for yt-dlp');
    }

    const commands = ['yt-dlp', 'youtube-dl'];
    let proc = null;
    let commandFound = false;

    for (const cmd of commands) {
      try {
        proc = spawn(cmd, args, { 
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false 
        });
        
        commandFound = true;
        console.log(`✅ Found ${cmd} in system PATH`);
        
        // Pipe stdout to our PassThrough stream
        proc.stdout.pipe(outputStream);
        
        // Handle stderr for progress
        let stderrData = '';
        proc.stderr.on('data', (chunk) => {
          const txt = chunk.toString();
          stderrData += txt;
          
          const match = txt.match(/(\d{1,3}(?:\.\d)?)%/);
          if (match && onProgress) {
            const percent = Math.min(100, Math.floor(parseFloat(match[1])));
            onProgress(percent);
          }
        });

        // Handle process exit
        proc.on('close', (code) => {
          if (code === 0) {
            outputStream.end();
            resolve(outputStream);
          } else {
            console.error(`${cmd} stderr:`, stderrData);
            reject(new Error(`${cmd} exited with code ${code}: ${stderrData}`));
          }
        });

        proc.on('error', (err) => {
          reject(err);
        });

        if (commandFound) break;
      } catch (err) {
        console.warn(`⚠️ ${cmd} not found:`, err.message);
        continue;
      }
    }

    if (!commandFound) {
      reject(new Error('No youtube downloader found in system PATH'));
    }
  });
}

// Method 3: Using ytdl-core with cookies
async function streamWithYtdlCore(url, onProgress) {
  try {
    console.log('🎵 Attempting download with ytdl-core...');
    
    const normalizedUrl = normalizeYoutubeUrl(url);
    
    const options = {
      quality: 'highestaudio',
      filter: 'audioonly',
      highWaterMark: 1 << 25,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    };

    // Add cookie if available
    if (process.env.YOUTUBE_COOKIE) {
      options.requestOptions.headers.cookie = process.env.YOUTUBE_COOKIE;
      console.log('🍪 Using YouTube cookie for ytdl-core');
    }

    const info = await ytdl.getInfo(normalizedUrl, options);
    const stream = ytdl.downloadFromInfo(info, options);
    
    // Wrap in PassThrough to avoid EOF issues
    const outputStream = new PassThrough();
    stream.pipe(outputStream);
    
    if (onProgress) {
      stream.on('progress', (_, downloaded, total) => {
        const percent = Math.min(99, Math.floor((downloaded / total) * 100));
        onProgress(percent);
      });
    }
    
    stream.on('end', () => {
      outputStream.end();
    });
    
    stream.on('error', (err) => {
      outputStream.destroy(err);
    });
    
    return outputStream;
  } catch (error) {
    console.error('❌ ytdl-core failed:', error.message);
    throw error;
  }
}

async function getVideoInfo(url) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  
  const methods = [
    // Try ytdl-core first
    async () => {
      const options = {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        }
      };
      if (process.env.YOUTUBE_COOKIE) {
        options.requestOptions.headers.cookie = process.env.YOUTUBE_COOKIE;
      }
      
      const info = await ytdl.getInfo(normalizedUrl, options);
      return {
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds,
        thumbnail: info.videoDetails.thumbnails?.[0]?.url
      };
    },
    // Try youtube-dl-exec
    async () => {
      const options = {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        addHeader: ['user-agent:Mozilla/5.0'],
        cookiesFromBrowser: 'chrome',
      };
      
      if (process.env.YOUTUBE_COOKIES_FILE && fs.existsSync(process.env.YOUTUBE_COOKIES_FILE)) {
        options.cookies = process.env.YOUTUBE_COOKIES_FILE;
        delete options.cookiesFromBrowser;
      }
      
      const info = await youtubedl(normalizedUrl, options);
      return {
        title: info.title || 'Unknown Title',
        duration: info.duration,
        thumbnail: info.thumbnail
      };
    }
  ];

  for (const method of methods) {
    try {
      return await method();
    } catch (error) {
      console.warn('⚠️ Video info method failed:', error.message);
      continue;
    }
  }

  console.error('❌ All methods failed to get video info');
  return {
    title: 'Unknown Title',
    duration: null,
    thumbnail: null
  };
}

async function createAudioStream(url, onProgress) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  
  // Define download methods in order of preference
  const methods = [
    {
      name: 'youtube-dl-exec',
      func: () => streamWithYoutubeDlExec(normalizedUrl, onProgress)
    },
    {
      name: 'system-ytdlp', 
      func: () => streamWithSystemYtDlp(normalizedUrl, onProgress)
    },
    {
      name: 'ytdl-core',
      func: () => streamWithYtdlCore(normalizedUrl, onProgress)
    }
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