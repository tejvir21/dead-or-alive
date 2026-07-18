/**
 * Dead or Alive: Logic Escape — Server Entry Point Phase 1
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const clueRoutes = require('./routes/clues');
const settingsRoutes = require('./routes/settings');
const { statsRouter, adminRouter } = require('./routes/statsAdmin');
const betaRouter = require('./routes/beta');
const notificationRouter = require('./routes/notifications');
const initSocket = require('./socket/socketHandlers');
const { apiLimiter } = require('./middleware/security');
const GameSettings = require('./models/GameSettings');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: (process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174').split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Maintenance mode middleware ───────────────────────────────────────────────
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api/auth') || req.path === '/health') return next();
  try {
    const settings = await GameSettings.getSingleton();
    if (settings.features.maintenanceMode)
      return res.status(503).json({ error: 'Server under maintenance. Check back soon.' });
  } catch (_) { }
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', apiLimiter, authRoutes);
app.use('/api/game', apiLimiter, gameRoutes);
app.use('/api/clues', apiLimiter, clueRoutes);
app.use('/api/settings', apiLimiter, settingsRoutes);
app.use('/api/stats', apiLimiter, statsRouter);
app.use('/api/admin', apiLimiter, adminRouter);
app.use('/api/beta', apiLimiter, betaRouter);
app.use('/api/notifications', apiLimiter, notificationRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});
app.set('io', io);
initSocket(io);

// ── MongoDB ───────────────────────────────────────────────────────────────────
const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dead-or-alive');
  logger.info('✅ MongoDB connected');
  // Ensure settings singleton exists
  await GameSettings.getSingleton();
};

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
connectDB().then(() => {
  server.listen(PORT, () => {
    logger.info(`🎮 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}).catch(err => {
  logger.error('Startup failed:', err);
  process.exit(1);
});

process.on('SIGTERM', () => server.close(() => mongoose.connection.close(false, () => process.exit(0))));
