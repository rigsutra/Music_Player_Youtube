// /utils/youtube.js - Complete fixed version
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

// Enhanced Method 1: youtube-dl-exec with better timeout and error handling
async function streamWithYoutubeDlExec(url, onProgress) {
  try {
    console.log('🎵 Starting youtube-dl-exec download...');
    
    const outputStream = new PassThrough();
    
    const options = {
      extractAudio: true,
      audioFormat: 'best',
      audioQuality: 0, // Best quality
      noCheckCertificate: true,
      noWarnings: true,
      preferFreeFormats: true,
      // Better user agent to avoid detection
      addHeader: [
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      output: '-',
      // Additional options to improve success rate
      retries: 3,
      fragmentRetries: 3,
      skipUnavailableFragments: true,
      // Add socket timeout to handle slow downloads
      socketTimeout: 30, // 30 seconds per chunk
    };

    // Get writable cookie path
    const cookiePath = await getWritableCookiePath();
    if (cookiePath) {
      options.cookies = cookiePath;
      console.log('🍪 Using cookies from:', cookiePath);
    } else {
      console.log('🍪 No cookies available, proceeding without');
    }

    // Execute yt-dlp with longer timeout
    const subprocess = youtubedl.exec(url, options);
    
    // Set up timeout (120 seconds - much longer for slow downloads)
    const timeout = setTimeout(() => {
      console.log('⏰ Download timeout after 120 seconds, killing process...');
      subprocess.kill('SIGKILL');
      outputStream.destroy(new Error('Download timeout after 120 seconds'));
    }, 120000); // 2 minutes
    
    // Track if we've received any data
    let hasReceivedData = false;
    
    // Pipe stdout to output stream
    subprocess.stdout.on('data', (chunk) => {
      hasReceivedData = true;
      outputStream.write(chunk);
    });
    
    subprocess.stdout.on('end', () => {
      outputStream.end();
    });
    
    // Enhanced progress tracking
    let lastProgress = 0;
    let hasStartedDownload = false;
    let downloadSize = null;
    
    subprocess.stderr.on('data', (data) => {
      const text = data.toString();
      
      // Ignore cookie write errors
      if (text.includes('OSError') || text.includes('Read-only file system')) {
        return;
      }
      
      // Check for download start and extract file size
      if (text.includes('[download]') && !hasStartedDownload) {
        hasStartedDownload = true;
        console.log('📥 Download started');
        if (onProgress) onProgress(0, 'Starting download...');
        
        // Try to extract file size
        const sizeMatch = text.match(/(\d+(?:\.\d+)?[KMGT]?iB)/);
        if (sizeMatch) {
          downloadSize = sizeMatch[1];
          console.log(`📊 File size: ${downloadSize}`);
        }
      }
      
      // Extract progress percentage
      const progressMatch = text.match(/(\d+(?:\.\d+)?)%/);
      if (progressMatch && onProgress) {
        const percent = Math.floor(parseFloat(progressMatch[1]));
        if (percent > lastProgress) {
          lastProgress = percent;
          
          // Try to extract download speed
          const speedMatch = text.match(/(\d+(?:\.\d+)?[KMGT]?iB\/s)/);
          const speed = speedMatch ? speedMatch[1] : null;
          
          // Try to extract ETA
          const etaMatch = text.match(/ETA (\d{2}:\d{2})/);
          const eta = etaMatch ? etaMatch[1] : null;
          
          let statusMessage = `Progress: ${percent}%`;
          if (downloadSize) statusMessage += ` of ${downloadSize}`;
          if (speed) statusMessage += ` at ${speed}`;
          if (eta) statusMessage += ` (ETA: ${eta})`;
          
          onProgress(percent, statusMessage);
        }
      }
      
      // Check for specific errors that should cause immediate failure
      if (text.includes('Video unavailable')) {
        clearTimeout(timeout);
        outputStream.destroy(new Error('Video is unavailable'));
      } else if (text.includes('Private video')) {
        clearTimeout(timeout);
        outputStream.destroy(new Error('Video is private'));
      } else if (text.includes('Sign in to confirm your age')) {
        clearTimeout(timeout);
        outputStream.destroy(new Error('Video is age-restricted'));
      }
    });

    subprocess.on('error', (err) => {
      clearTimeout(timeout);
      console.error('Process error:', err.message);
      if (!outputStream.destroyed) {
        outputStream.destroy(err);
      }
    });

    subprocess.on('exit', (code, signal) => {
      clearTimeout(timeout);
      
      if (signal === 'SIGKILL') {
        console.log('⚠️ Download was killed (likely timeout)');
        if (hasReceivedData) {
          // If we got some data, this might be a timeout during a working download
          console.log('📊 Partial data received before timeout');
          if (onProgress) onProgress(99, 'Download incomplete due to timeout');
        }
        if (!outputStream.destroyed) {
          outputStream.destroy(new Error('Download was terminated'));
        }
      } else if (code === 0) {
        console.log('✅ Download completed successfully');
        if (onProgress) onProgress(100, 'Download completed!');
      } else if (code === 1) {
        console.log('⚠️ Download completed with warnings');
        if (onProgress) onProgress(100, 'Download completed with warnings');
      } else {
        console.error(`❌ yt-dlp exited with code ${code}, signal: ${signal}`);
        if (!outputStream.destroyed) {
          outputStream.destroy(new Error(`Download failed with exit code ${code}`));
        }
      }
    });

    return outputStream;
  } catch (error) {
    console.error('❌ youtube-dl-exec setup failed:', error.message);
    throw error;
  }
}

// Method 2: ytdl-core with enhanced progress tracking
async function streamWithYtdlCore(url, onProgress) {
  try {
    console.log('🎵 Starting ytdl-core download...');
    const normalizedUrl = normalizeYoutubeUrl(url);
    
    const stream = ytdl(normalizedUrl, {
      quality: 'highestaudio',
      filter: 'audioonly',
      highWaterMark: 1 << 25,
    });
    
    const outputStream = new PassThrough();
    stream.pipe(outputStream);
    
    if (onProgress) {
      let lastPercent = 0;
      
      stream.on('progress', (chunkLength, downloaded, total) => {
        const percent = Math.min(99, Math.floor((downloaded / total) * 100));
        
        if (percent > lastPercent) {
          lastPercent = percent;
          
          // Calculate download speed (rough estimate)
          const totalMB = (total / (1024 * 1024)).toFixed(1);
          const downloadedMB = (downloaded / (1024 * 1024)).toFixed(1);
          
          const statusMessage = `Progress: ${percent}% (${downloadedMB}MB / ${totalMB}MB)`;
          onProgress(percent, statusMessage);
        }
      });
      
      stream.on('end', () => {
        onProgress(100, 'Download completed!');
      });
    }
    
    console.log('✅ ytdl-core stream created successfully');
    return outputStream;
  } catch (error) {
    console.error('❌ ytdl-core failed:', error.message);
    throw error;
  }
}

// Method 3: System yt-dlp with enhanced progress tracking
function streamWithSystemYtDlp(url, onProgress) {
  return new Promise(async (resolve, reject) => {
    console.log('🎵 Starting system yt-dlp download...');
    
    const outputStream = new PassThrough();
    const args = [
      '-f', 'bestaudio',
      '-o', '-',
      '--no-playlist',
      '--no-check-certificate',
      '--retries', '3',
      '--fragment-retries', '3',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      url
    ];

    // Add cookies if available
    const cookiePath = await getWritableCookiePath();
    if (cookiePath) {
      args.push('--cookies', cookiePath);
      console.log('🍪 Using cookies for system yt-dlp');
    }

    const commands = ['yt-dlp', 'youtube-dl'];
    
    for (const cmd of commands) {
      try {
        console.log(`🔍 Trying ${cmd}...`);
        const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        
        console.log(`✅ Found ${cmd}, starting download`);
        
        proc.stdout.pipe(outputStream);
        
        let lastProgress = 0;
        
        proc.stderr.on('data', (chunk) => {
          const text = chunk.toString();
          
          // Ignore cookie/filesystem errors
          if (text.includes('OSError') || text.includes('Read-only file system')) {
            return;
          }
          
          // Extract progress
          const progressMatch = text.match(/(\d+(?:\.\d+)?)%/);
          if (progressMatch && onProgress) {
            const percent = Math.floor(parseFloat(progressMatch[1]));
            if (percent > lastProgress) {
              lastProgress = percent;
              
              // Try to extract additional info
              const speedMatch = text.match(/(\d+(?:\.\d+)?[KMGT]?iB\/s)/);
              const speed = speedMatch ? ` at ${speedMatch[1]}` : '';
              
              onProgress(percent, `Progress: ${percent}%${speed}`);
            }
          }
          
          // Log download start
          if (text.includes('[download]') && text.includes('Destination:')) {
            if (onProgress) onProgress(0, 'Starting download...');
          }
        });

        proc.on('close', (code) => {
          if (code === 0 || code === 1) {
            console.log(`✅ ${cmd} completed successfully`);
            if (onProgress) onProgress(100, 'Download completed!');
            resolve(outputStream);
          } else {
            console.error(`❌ ${cmd} exited with code ${code}`);
            reject(new Error(`${cmd} exited with code ${code}`));
          }
        });

        proc.on('error', (err) => {
          console.error(`❌ ${cmd} process error:`, err.message);
          reject(err);
        });
        
        return; // Exit the loop if we successfully started the process
      } catch (err) {
        console.log(`⚠️ ${cmd} not found, trying next...`);
        continue;
      }
    }
    
    reject(new Error('No youtube downloader found (yt-dlp or youtube-dl)'));
  });
}

// Main function with improved fallback logic and progress tracking
async function createAudioStream(url, onProgress) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  console.log(`🎯 Starting download for: ${normalizedUrl}`);
  
  // Enhanced progress callback that includes method info
  const enhancedProgress = (percent, message = '', method = '') => {
    if (onProgress) {
      const fullMessage = method ? `[${method}] ${message}` : message;
      onProgress(percent, fullMessage);
    }
  };
  
  // Primary method - youtube-dl-exec (most reliable)
  try {
    console.log('🥇 Trying youtube-dl-exec (primary method)...');
    if (onProgress) onProgress(0, 'Initializing youtube-dl-exec...');
    
    const stream = await streamWithYoutubeDlExec(normalizedUrl, (percent, msg) => 
      enhancedProgress(percent, msg, 'yt-dlp')
    );
    
    if (stream) {
      console.log('✅ Success with youtube-dl-exec');
      return { stream, method: 'youtube-dl-exec' };
    }
  } catch (error) {
    console.error('❌ youtube-dl-exec failed:', error.message);
    
    // Check if it's a rate limit or temporary error
    const isTemporaryError = error.message.includes('429') || 
                           error.message.includes('rate') ||
                           error.message.includes('timeout') ||
                           error.message.includes('unavailable') ||
                           error.message.includes('Too Many Requests');
    
    if (isTemporaryError) {
      console.log('⏳ Detected temporary error, waiting 5 seconds before fallback...');
      if (onProgress) onProgress(0, 'Rate limited, waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('⏳ Waiting 2 seconds before fallback...');
      if (onProgress) onProgress(0, 'Switching to fallback method...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Fallback 1 - ytdl-core (no external deps, different approach)
  try {
    console.log('🥈 Trying ytdl-core (fallback 1)...');
    if (onProgress) onProgress(0, 'Initializing ytdl-core...');
    
    const stream = await streamWithYtdlCore(normalizedUrl, (percent, msg) => 
      enhancedProgress(percent, msg, 'ytdl-core')
    );
    
    if (stream) {
      console.log('✅ Success with ytdl-core');
      return { stream, method: 'ytdl-core' };
    }
  } catch (error) {
    console.error('❌ ytdl-core failed:', error.message);
    console.log('⏳ Waiting 3 seconds before final fallback...');
    if (onProgress) onProgress(0, 'Trying final fallback method...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Final fallback - system ytdlp (different binary version might work)
  try {
    console.log('🥉 Trying system ytdlp (final fallback)...');
    if (onProgress) onProgress(0, 'Initializing system yt-dlp...');
    
    const stream = await streamWithSystemYtDlp(normalizedUrl, (percent, msg) => 
      enhancedProgress(percent, msg, 'system-ytdlp')
    );
    
    if (stream) {
      console.log('✅ Success with system ytdlp');
      return { stream, method: 'system-ytdlp' };
    }
  } catch (error) {
    console.error('❌ All methods failed. Last error:', error.message);
    if (onProgress) onProgress(0, 'All download methods failed');
    
    throw new Error(`All download methods failed. YouTube might be blocking requests or the video is unavailable. Last error: ${error.message}`);
  }
}

// Enhanced video info function
async function getVideoInfo(url) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  console.log('🔍 Fetching video information...');
  
  try {
    const options = {
      dumpSingleJson: true,
      noCheckCertificate: true,
      noWarnings: true,
      addHeader: ['user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'],
    };
    
    // Use writable cookie copy
    const cookiePath = await getWritableCookiePath();
    if (cookiePath) {
      options.cookies = cookiePath;
    }
    
    const info = await youtubedl(normalizedUrl, options);
    
    const result = {
      title: sanitizeFileName(info.title || 'Unknown Title'),
      duration: info.duration,
      thumbnail: info.thumbnail,
      uploader: info.uploader,
      upload_date: info.upload_date,
      view_count: info.view_count,
      like_count: info.like_count,
      description: info.description ? info.description.substring(0, 500) : null
    };
    
    console.log(`✅ Video info retrieved: "${result.title}"`);
    return result;
  } catch (error) {
    console.warn('⚠️ Video info failed, using defaults:', error.message.split('\n')[0]);
    return {
      title: 'Unknown Title',
      duration: null,
      thumbnail: null,
      uploader: null,
      upload_date: null,
      view_count: null,
      like_count: null,
      description: null
    };
  }
}

// Add process-level error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // For uncaught exceptions, we should exit gracefully
  process.exit(1);
});

module.exports = {
  sanitizeFileName,
  normalizeYoutubeUrl,
  isValidYouTubeUrl,
  getVideoInfo,
  createAudioStream,
  YOUTUBE_REGEX
};