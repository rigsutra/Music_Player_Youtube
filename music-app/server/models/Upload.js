// /models/Upload.js - Upload tracking model
const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
  uploadId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  youtubeUrl: {
    type: String,
    required: true
  },
  videoTitle: {
    type: String,
    default: 'Processing...'
  },
  fileName: {
    type: String
  },
  progress: {
    type: Number,
    default: 0
  },
  stage: {
    type: String,
    enum: ['starting', 'downloading', 'uploading', 'done', 'error', 'canceled'],
    default: 'starting'
  },
  error: {
    type: String
  },
  googleFileId: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Auto-cleanup after 24 hours
uploadSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('Upload', uploadSchema);