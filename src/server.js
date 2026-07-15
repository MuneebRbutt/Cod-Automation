require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const testRoutes = require('./routes/testRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { startScheduler } = require('./services/scheduler');

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

// Serve static frontend for dashboard
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', testRoutes);
app.use('/webhook', webhookRoutes);
app.use('/dashboard', dashboardRoutes);

// Root routes to UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Background Scheduler
startScheduler();

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
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

// trigger restart

// nodemon restart trigger
