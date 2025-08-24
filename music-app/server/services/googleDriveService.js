// /services/googleDriveService.js - Google Drive operations
const { google } = require('googleapis');
const User = require('../models/User');

class GoogleDriveService {
  constructor() {
    this.FOLDER_NAME = 'Music Player';
  }

  createOAuth2Client(tokens = null) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    if (tokens) {
      oauth2Client.setCredentials(tokens);
    }
    
    return oauth2Client;
  }

  async ensureUserMusicFolder(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Check if folder already exists
    if (user.musicFolderId) {
      try {
        const oauth2Client = this.createOAuth2Client(user.googleTokens);
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        
        await drive.files.get({ fileId: user.musicFolderId });
        console.log(`📁 Using existing folder for user ${userId}: ${user.musicFolderId}`);
        return user.musicFolderId;
      } catch (error) {
        console.log(`📁 Folder no longer exists for user ${userId}, creating new one`);
        user.musicFolderId = null;
      }
    }

    // Create new folder
    try {
      const oauth2Client = this.createOAuth2Client(user.googleTokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      const folderMetadata = {
        name: `${this.FOLDER_NAME} - ${user.name}`,
        mimeType: 'application/vnd.google-apps.folder',
        description: `Music Player folder for ${user.email}`
      };

      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id, name',
      });

      // Save folder ID to user
      user.musicFolderId = folder.data.id;
      await user.save();
      
      console.log(`📁 Created new folder for user ${userId}: ${folder.data.id}`);
      return folder.data.id;
      
    } catch (error) {
      console.error(`❌ Error creating folder for user ${userId}:`, error.message);
      throw new Error('Failed to create music folder');
    }
  }

  async uploadFile(userId, fileName, stream, mimeType = 'audio/webm') {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const folderId = await this.ensureUserMusicFolder(userId);
    const oauth2Client = this.createOAuth2Client(user.googleTokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeType,
        parents: [folderId],
        description: `Uploaded by Music Player app for ${user.email}`
      },
      media: { mimeType: mimeType, body: stream },
    });

    return response.data.id;
  }

  async listUserFiles(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const folderId = await this.ensureUserMusicFolder(userId);
    const oauth2Client = this.createOAuth2Client(user.googleTokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType contains 'audio/' and trashed=false`,
      fields: 'files(id, name, webContentLink, createdTime, size)',
      orderBy: 'createdTime desc'
    });
    
    return response.data.files;
  }

  async streamFile(userId, fileId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const oauth2Client = this.createOAuth2Client(user.googleTokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Verify file belongs to user
    const folderId = await this.ensureUserMusicFolder(userId);
    const fileInfo = await drive.files.get({
      fileId,
      fields: 'id, name, parents, mimeType, size'
    });

    if (!fileInfo.data.parents || !fileInfo.data.parents.includes(folderId)) {
      throw new Error('Access denied: File not in user folder');
    }

    if (!fileInfo.data.mimeType.includes('audio')) {
      throw new Error('Access denied: Not an audio file');
    }

    return { drive, fileInfo: fileInfo.data };
  }
}

module.exports = new GoogleDriveService();