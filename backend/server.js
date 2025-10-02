require('dotenv').config();

console.log('MONGO_URI from env:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mainPageRoutes = require('./routes/mainpageroute');
const apiRoutes = require('./routes/api');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require("path");

const isProd = process.env.NODE_ENV === 'production';
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== CORS Setup =====
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true // allow cookies
}));

// Handle preflight requests
app.options('*', cors());

// ===== Security & Cache Headers ===== //
app.use((req, res, next) => {
  // Prevent caching of sensitive responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  next();
});

// ===== SESSION SETUP ===== //
app.set('trust proxy', 1); // important when behind Render's proxy

app.use(session({
  name: 'sessionId',
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: 'PTW',
    ttl: 2 * 60 * 60 // 2 hours in seconds
  }),
  cookie: {
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    httpOnly: true,
    sameSite: 'none', // required for cross-site cookies
    secure: true      // must be true on HTTPS (Render provides HTTPS)
  }
}));

// 🔎 Debug middleware: log session on every request
app.use((req, res, next) => {
  if (req.session) {
    console.log('📦 Session check:', {
      id: req.session.id,
      userId: req.session.userId || null,
      cookie: req.session.cookie
    });
  } else {
    console.log('⚠️ No session object on request');
  }
  next();
});

// ===== Puppeteer Browser Reuse ===== //
let browser;
async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    console.log('✅ Chromium launched and cached');
  }
  return browser;
}

app.set('getBrowser', getBrowser);

// Optional: close browser gracefully on shutdown
async function closeBrowser() {
  if (browser) {
    await browser.close();
    console.log('🛑 Chromium closed');
    browser = null;
  }
}

// ===== ROUTES ===== //
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

app.use('/mainpage', mainPageRoutes);
app.use('/api', apiRoutes);

// ===== MONGODB CONNECTION =====//
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'PTW'
})
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ===== GLOBAL ERROR HANDLER ===== //
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  console.error('Error stack:', err.stack);

  res.status(err.status || 500).json({
    message: isProd ? 'An unexpected error occurred' : err.message,
    ...(isProd ? {} : { stack: err.stack })
  });
});

// ===== START SERVER ======= //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed for origins: ${allowedOrigins}`);
  // Warm up Chromium so first request is fast
  getBrowser().then(() => console.log('Chromium warmed up 🚀'));

  // Graceful shutdown
  process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
  process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });

  //=========PRE APPROVER======= //
  const preApproverRoutes = require("./routes/preApprover");
  app.use("/preapprover", preApproverRoutes);
});
