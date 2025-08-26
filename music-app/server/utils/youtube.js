// /utils/youtube.js - YouTube utilities with multiple fallbacks
const ytdl = require('@distube/ytdl-core');
const youtubedl = require('youtube-dl-exec');
const { spawn } = require('child_process');
const path = require('path');
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

// Method 1: Using youtube-dl-exec package properly
async function streamWithYoutubeDlExec(url, onProgress) {
  try {
    console.log('🎵 Attempting download with youtube-dl-exec...');
    
    // Create a PassThrough stream to return immediately
    const { PassThrough } = require('stream');
    const outputStream = new PassThrough();
    
    // Download to buffer first (more reliable for problematic videos)
    const output = await youtubedl(url, {
      extractAudio: true,
      audioFormat: 'best',
      noCheckCertificate: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ['user-agent:Mozilla/5.0'],
      cookies: process.env.YOUTUBE_COOKIES_FILE, // Optional: path to cookies file
      output: '-', // Output to stdout
      quiet: true,
    });
    
    // If we get here, download was successful
    outputStream.end(output);
    if (onProgress) onProgress(100);
    
    return outputStream;
  } catch (error) {
    console.error('❌ youtube-dl-exec failed:', error.message);
    throw error;
  }
}

// Method 2: Using spawn with system yt-dlp
function streamWithSystemYtDlp(url, onProgress) {
  return new Promise((resolve, reject) => {
    console.log('🎵 Attempting download with system yt-dlp...');
    
    const args = [
      '-f', 'bestaudio',
      '-o', '-',
      '--no-playlist',
      '--no-check-certificate',
      '--user-agent', 'Mozilla/5.0',
      url
    ];

    // Try different possible yt-dlp locations
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
        
        // Handle stderr for progress
        proc.stderr.on('data', (chunk) => {
          const txt = chunk.toString();
          const match = txt.match(/(\d{1,3}\.\d)%/);
          if (match && onProgress) {
            const percent = Math.min(100, Math.floor(parseFloat(match[1])));
            onProgress(percent);
          }
        });

        // Handle process errors
        proc.on('error', (err) => {
          if (err.code === 'ENOENT') {
            commandFound = false;
          } else {
            reject(err);
          }
        });

        proc.on('close', (code) => {
          if (code !== 0 && code !== null) {
            reject(new Error(`${cmd} exited with code ${code}`));
          }
        });

        if (commandFound) {
          resolve(proc.stdout);
          break;
        }
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

// Method 3: Using ytdl-core with better error handling
async function streamWithYtdlCore(url, onProgress) {
  try {
    console.log('🎵 Attempting download with ytdl-core...');
    
    const normalizedUrl = normalizeYoutubeUrl(url);
    
    // Add cookies if available
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

    // If you have cookies, add them
    if (process.env.YOUTUBE_COOKIE) {
      options.requestOptions.headers.cookie = process.env.YOUTUBE_COOKIE;
    }

    const info = await ytdl.getInfo(normalizedUrl, options);
    const stream = ytdl.downloadFromInfo(info, options);
    
    if (onProgress) {
      stream.on('progress', (_, downloaded, total) => {
        const percent = Math.min(99, Math.floor((downloaded / total) * 100));
        onProgress(percent);
      });
    }
    
    return stream;
  } catch (error) {
    console.error('❌ ytdl-core failed:', error.message);
    throw error;
  }
}

// Method 4: Using play-dl as alternative (install with: npm install play-dl)
async function streamWithPlayDl(url, onProgress) {
  try {
    // Only try if play-dl is installed
    const play = require('play-dl');
    
    console.log('🎵 Attempting download with play-dl...');
    
    const stream = await play.stream(url, {
      quality: 2, // 0 = lowest, 2 = highest
    });
    
    if (onProgress) {
      // play-dl doesn't have built-in progress, so we fake it
      setTimeout(() => onProgress(50), 1000);
      setTimeout(() => onProgress(99), 2000);
    }
    
    return stream.stream;
  } catch (error) {
    console.error('❌ play-dl failed or not installed:', error.message);
    throw error;
  }
}

async function getVideoInfo(url) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  
  // Try multiple methods to get video info
  const methods = [
    // Method 1: ytdl-core
    async () => {
      const info = await ytdl.getInfo(normalizedUrl, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        }
      });
      return {
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds,
        thumbnail: info.videoDetails.thumbnails?.[0]?.url
      };
    },
    // Method 2: youtube-dl-exec
    async () => {
      const info = await youtubedl(normalizedUrl, {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: ['user-agent:Mozilla/5.0'],
      });
      return {
        title: info.title || 'Unknown Title',
        duration: info.duration,
        thumbnail: info.thumbnail
      };
    },
    // Method 3: play-dl (if installed)
    async () => {
      try {
        const play = require('play-dl');
        const info = await play.video_info(normalizedUrl);
        return {
          title: info.video_details.title,
          duration: info.video_details.durationInSec,
          thumbnail: info.video_details.thumbnails?.[0]?.url
        };
      } catch (e) {
        throw new Error('play-dl not available');
      }
    }
  ];

  // Try each method until one succeeds
  for (const method of methods) {
    try {
      return await method();
    } catch (error) {
      console.warn('⚠️ Video info method failed:', error.message);
      continue;
    }
  }

  // If all methods fail, return default
  console.error('❌ All methods failed to get video info');
  return {
    title: 'Unknown Title',
    duration: null,
    thumbnail: null
  };
}

async function createAudioStream(url, onProgress) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  
  // Define all download methods in order of preference
  const methods = [
    {
      name: 'ytdl-core',
      func: () => streamWithYtdlCore(normalizedUrl, onProgress)
    },
    {
      name: 'youtube-dl-exec',
      func: () => streamWithYoutubeDlExec(normalizedUrl, onProgress)
    },
    {
      name: 'system-ytdlp',
      func: () => streamWithSystemYtDlp(normalizedUrl, onProgress)
    },
    {
      name: 'play-dl',
      func: () => streamWithPlayDl(normalizedUrl, onProgress)
    }
  ];

  // Try each method until one succeeds
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

  // If all methods fail, throw the last error
  console.error('❌ All download methods failed');
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