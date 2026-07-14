require('dotenv').config();
const express = require('express');
const cors = require('cors');
const testRoutes = require('./routes/testRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', testRoutes);
const webhookRoutes = require('./routes/webhookRoutes');
app.use('/webhook', webhookRoutes);

// Root fallback
app.get('/', (req, res) => {
  res.send('Cod Automation Backend is running. Check /api/health for status.');
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Database test: http://localhost:${PORT}/api/test-db`);
});

process.on('exit', (code) => {
  console.log('Node process is exiting with code: ', code);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception: ', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

