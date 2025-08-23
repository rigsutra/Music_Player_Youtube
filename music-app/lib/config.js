// Centralized client/server runtime config
// Prefer environment variable NEXT_PUBLIC_API_BASE; fallback by NODE_ENV
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_PROD_API || 'https://your-api-domain.com'
    : 'http://localhost:8000');

// YouTube URL validation regex (video & shorts)
export const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)\w{11}(?:[&#?].*)?$/i;

export function sanitizeFileName(name) {
  return (name || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}