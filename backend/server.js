// ================= IMPORTS & CONFIG =================
require('dotenv').config();

console.log('MONGO_URI from env:', process.env.MONGO_URI);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const mainPageRoutes = require('./routes/mainpageroute');
const apiRoutes = require('./routes/api');
const isProd = process.env.NODE_ENV === 'production';

// ================= MIDDLEWARE =================
// Body parsers
//app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// ================= ROUTES =================
// Root test route
app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
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

const app = express();
const router = require('./api'); // your routes file

// Middleware
app.use(express.json());

// Mount your routes
app.use('/api', router);

// ✅ Global error handler goes here — after all routes
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

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});


// ================= START SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed for origins: ${allowedOrigins}`);
});
