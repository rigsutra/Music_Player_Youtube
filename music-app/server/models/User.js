// /models/User.js - User model
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  picture: {
    type: String
  },
  googleTokens: {
    access_token: String,
    refresh_token: String,
    scope: String,
    token_type: String,
    expiry_date: Number
  },
  musicFolderId: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update last active time on save
userSchema.pre('save', function(next) {
  this.lastActiveAt = new Date();
  next();
});

// Method to check if tokens are expired
userSchema.methods.isTokenExpired = function() {
  return this.googleTokens?.expiry_date ? this.googleTokens.expiry_date < Date.now() : true;
};

module.exports = mongoose.model('User', userSchema);