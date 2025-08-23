// // lib/utils.js
// export function formatTime(seconds) {
//   if (!seconds || isNaN(seconds)) return '0:00'
  
//   const mins = Math.floor(seconds / 60)
//   const secs = Math.floor(seconds % 60)
//   return `${mins}:${secs.toString().padStart(2, '0')}`
// }

// export function formatFileSize(bytes) {
//   if (!bytes) return ''
  
//   const sizes = ['B', 'KB', 'MB', 'GB']
//   const i = Math.floor(Math.log(bytes) / Math.log(1024))
//   return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
// }

// export function cn(...classes) {
//   return classes.filter(Boolean).join(' ')
// }


// export function formatTime(seconds) {
//   if (!seconds || isNaN(seconds)) return '0:00'
  
//   const mins = Math.floor(seconds / 60)
//   const secs = Math.floor(seconds % 60)
//   return `${mins}:${secs.toString().padStart(2, '0')}`
// }

// export function formatFileSize(bytes) {
//   if (!bytes) return ''
  
//   const sizes = ['B', 'KB', 'MB', 'GB']
//   const i = Math.floor(Math.log(bytes) / Math.log(1024))
//   return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
// }

// export function cn(...classes) {
//   return classes.filter(Boolean).join(' ')
// }


export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatFileSize(bytes) {
  if (!bytes) return ''
  
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}