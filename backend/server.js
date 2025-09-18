// ================= IMPORTS & CONFIG =================
require('dotenv').config();
console.log('MONGO_URI from env:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const MongoStore = require('connect-mongo');

const mainPageRoutes = require('./routes/mainpageroute');
const apiRoutes = require('./routes/api');

const app = express();

const isProd = process.env.NODE_ENV === 'production';

// ================= MIDDLEWARE =================
// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== CORS Setup =====
// ===== CORS Setup =====
const allowedOrigins = ['https://s338k.github.io']; // ✅ Explicitly allow GitHub Pages

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g. curl or mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true // ✅ Required to allow cookies to be sent and received
}));


// ===== TRUST PROXY SETUP =====
// Add this so that secure cookies and protocol detection work behind proxy if needed
if (isProd && process.env.BEHIND_PROXY === 'true') {
  app.set('trust proxy', 1);
  console.log('Trusting first proxy headers');
} else {
  console.log('Not trusting proxy headers');
}

// ===== SESSION SETUP =====
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: 'PTW',
    collectionName: 'sessions',
    ttl: 2 * 60 * 60 // 2 hours in seconds
  }),
  cookie: {
    httpOnly: true,
    secure: true, // HTTPS only in production
    sameSite: 'none', // 'none' with secure for cross-site cookies
    maxAge: 2 * 60 * 60 * 1000 // 2 hours in ms
  }
};

// Attach session middleware BEFORE your routes, and for ALL routes (not only /api)
app.use(session(sessionOptions));

// ================= ROUTES =================
// Root test route
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

// Session check endpoint
app.get('/api/session-check', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ message: 'Session active', userId: req.session.userId, username: req.session.username });
  } else {
    res.status(401).json({ message: 'No active session' });
  }
});

app.use('/mainpage', mainPageRoutes);
app.use('/api', apiRoutes);

// ================= MONGODB CONNECT =================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'PTW'
})
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed for origins: ${allowedOrigins}`);
});
