require('dotenv').config();
const logger = require('./logger');

// Do not print sensitive environment variables to logs in any environment.
// If you need to verify env vars during development, use a local-only debug flag.

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const apiRoutes = require('./routes/api');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const path = require("path");

const isProd = process.env.NODE_ENV === 'production';
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve frontend folder
app.use(express.static(path.join(__dirname, "../frontend")));

// Use Helmet for sensible security headers
app.use(helmet());

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
// Only set trust proxy when in production (e.g., behind a proxy like Render)
if (isProd) app.set('trust proxy', 1);

// Ensure a session secret is provided in production for cryptographic safety
const sessionSecret = process.env.SESSION_SECRET || 'supersecret';
if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'supersecret')) {
  throw new Error('SESSION_SECRET must be set to a strong value in production');
}

app.use(session({
  name: 'sessionId',
  secret: sessionSecret,
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
    // Use permissive sameSite in development to allow local dev over HTTP.
    sameSite: isProd ? 'none' : 'lax',
    // Only require secure cookies in production (HTTPS). In dev we allow insecure for localhost.
    secure: isProd
  }
}));

// 🔎 Debug middleware: log session on every request in non-production only
if (!isProd) {
  app.use((req, res, next) => {
    if (req.session) {
      logger.debug({
        id: req.session.id,
        userId: req.session.userId || null,
        cookie: req.session.cookie
      }, '📦 Session check');
    } else {
      logger.debug('⚠️ No session object on request');
    }
    next();
  });
}

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
    logger.info('✅ Chromium launched and cached');
  }
  return browser;
}

app.set('getBrowser', getBrowser);

// Optional: close browser gracefully on shutdown
async function closeBrowser() {
  if (browser) {
    await browser.close();
    logger.info('🛑 Chromium closed');
    browser = null;
  }
}

//=========ADMIN======= //
const adminRoutes = require("./routes/admin");
app.use("/admin", adminRoutes);

//=========PRE APPROVER======= //
const preApproverRoutes = require("./routes/preApprover");
app.use("/preapprover", preApproverRoutes);

// ===== ROUTES ===== //
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

app.use('/api', apiRoutes);

// ===== MONGODB CONNECTION =====//
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'PTW'
})
  .then(() => logger.info('MongoDB Connected'))
  .catch(err => logger.error(err));

// ===== GLOBAL ERROR HANDLER ===== //
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  logger.error({ method: req.method, url: req.originalUrl, stack: err.stack }, `[${timestamp}] Error handler`);

  res.status(err.status || 500).json({
    message: isProd ? 'An unexpected error occurred' : err.message,
    ...(isProd ? {} : { stack: err.stack })
  });
});

// ===== START SERVER ======= //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.debug(`CORS allowed for origins: ${allowedOrigins}`);
  // Warm up Chromium so first request is fast
  getBrowser().then(() => logger.info('Chromium warmed up 🚀'));

  // Graceful shutdown
  process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
  process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });
});
