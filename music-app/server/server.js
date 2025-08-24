// /server.js - Main server file
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const songRoutes = require('./routes/songs');
const uploadRoutes = require('./routes/upload');
const userRoutes = require('./routes/user');

// Import middleware
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 8000;

// --- Database Connection ---
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/music_player', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('🍃 MongoDB connected successfully'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Middleware ---
app.use(cors({
  origin: [
    process.env.NEXT_PUBLIC_PROD_FRONTEND_API,
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'https://your-domain.com'
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// --- Routes ---
app.get('/', (req, res) => {
  res.json({
    message: "🎵 Multi-User Music Streaming App",
    version: "2.0.0",
    database: "MongoDB",
    status: "running"
  });
});

app.get('/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const User = require('./models/User');
    const activeUsers = await User.countDocuments({ lastActiveAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    
    res.json({
      status: 'healthy',
      database: dbState === 1 ? 'connected' : 'disconnected',
      activeUsers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// API Routes
app.use('/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/user', userRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  mongoose.connection.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🎵 Music Player Server running on Port: ${PORT}`);
  console.log(`🔐 Authentication: http://localhost:${PORT}/auth/google`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});