// /utils/youtube.js - YouTube utilities
const ytdl = require('@distube/ytdl-core');
const { spawn } = require('child_process');
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

function streamWithYtDlp(url, onProgress) {
  const ytDlpPath = path.join(__dirname, '..', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
  const args = ['-f', 'bestaudio', '-o', '-', '--no-playlist', url];
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

async function getVideoInfo(url) {
  try {
    const normalizedUrl = normalizeYoutubeUrl(url);
    const info = await ytdl.getInfo(normalizedUrl);
    return {
      title: info.videoDetails.title,
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails?.[0]?.url
    };
  } catch (error) {
    console.error('❌ Error getting video info:', error.message);
    return {
      title: 'Unknown Title',
      duration: null,
      thumbnail: null
    };
  }
}

async function createAudioStream(url, onProgress) {
  const normalizedUrl = normalizeYoutubeUrl(url);
  
  try {
    const info = await ytdl.getInfo(normalizedUrl);
    const stream = ytdl.downloadFromInfo(info, {
      quality: 'highestaudio',
      filter: 'audioonly',
      highWaterMark: 1 << 25
    });
    
    if (onProgress) {
      stream.on('progress', (_, downloaded, total) => {
        const percent = Math.min(99, Math.floor((downloaded / total) * 100));
        onProgress(percent);
      });
    }
    
    return { stream, info };
  } catch (error) {
    console.warn('⚠️ ytdl-core failed, falling back to yt-dlp:', error.message);
    const stream = streamWithYtDlp(normalizedUrl, onProgress);
    return { stream, info: null };
  }
}

module.exports = {
  sanitizeFileName,
  normalizeYoutubeUrl,
  isValidYouTubeUrl,
  getVideoInfo,
  createAudioStream,
  YOUTUBE_REGEX
};