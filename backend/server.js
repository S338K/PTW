require('dotenv').config();

console.log('MONGO_URI from env:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const mainPageRoutes = require('./routes/mainpageroute');
const apiRoutes = require('./routes/api');
const isProd = process.env.NODE_ENV === 'production';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== CORS Setup =====
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Handle preflight requests explicitly (optional but safe)
app.options('*', cors());

// === SESSION AND COOKIE SETUP START ===
// Added for login sessions, idle timeout, and cookie management
const session = require('express-session');
const MongoStore = require('connect-mongo');

app.use(session({
  name: 'sid', // cookie name
  secret: process.env.SESSION_SECRET, // add to .env
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    httpOnly: true,
    secure: isProd, // true if using https
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
  }
}));

// Idle timeout middleware
app.use((req, res, next) => {
  // Skip login and signup routes
  if (req.path === '/api/login' || req.path === '/api/signup') return next();

  if (!req.session.userId) return next(); // no session yet

  const now = Date.now();
  const maxIdle = 10 * 60 * 1000; // 10 minutes

  if (req.session.lastActivity && now - req.session.lastActivity > maxIdle) {
    // Inactivity timeout
    req.session.destroy(err => {
      if (err) console.error('Session destroy error:', err);
      res.clearCookie('sid');
      return res.status(440).json({ message: 'Session expired due to inactivity' });
    });
  } else {
    req.session.lastActivity = now; // update last activity timestamp
    next();
  }
});
// === SESSION AND COOKIE SETUP END ===

app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

app.use('/mainpage', mainPageRoutes);
app.use('/api', apiRoutes);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'PTW'
})
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ✅ Global error handler — must have 4 params
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  console.error('Error stack:', err.stack);

  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed for origins: ${allowedOrigins}`);
});