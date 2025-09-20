require('dotenv').config();

console.log('MONGO_URI from env:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mainPageRoutes = require('./routes/mainpageroute');
const apiRoutes = require('./routes/api');

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
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// ===== SESSION SETUP =====
app.use(session({
  name: 'sessionId', // cookie name
  secret: process.env.SESSION_SECRET || 'defaultsecret', // strong secret recommended
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI, dbName: 'PTW' }),
  cookie: {
    maxAge: 2 * 60 * 60 * 1000, // 2 hours
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax', // 'none' for cross-site in production
    secure: isProd,                    // true on HTTPS
  }
}));

// ===== ROUTES =====
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

app.use('/mainpage', mainPageRoutes);
app.use('/api', apiRoutes);

// ===== MONGODB CONNECTION =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: 'PTW'
})
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ===== GLOBAL ERROR HANDLER =====
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  console.error('Error stack:', err.stack);

  res.status(err.status || 500).json({
    message: isProd ? 'An unexpected error occurred' : err.message,
    ...(isProd ? {} : { stack: err.stack })
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed for origins: ${allowedOrigins}`);
});