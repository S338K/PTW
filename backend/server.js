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

// ================= MIDDLEWARE =================
// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root test route
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

// ===== CORS Setup =====
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true
}));

// ===== SESSION SETUP =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    dbName: 'PTW',
    collectionName: 'sessions',
    ttl: 60 * 60 // 30 minutes
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 // 60 minutes
  }
}));

// ================= ROUTES =================
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