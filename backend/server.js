const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});


// ===== CORS Setup =====
const allowedOrigins = process.env.ALLOWED_ORIGIN 
  ? process.env.ALLOWED_ORIGIN.split(',')
  : ['http://127.0.0.1:5500']; // frontend ka origin yahan daalein

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true // important for cookies/session
}));


// ===== Session Setup =====
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // HTTPS use kar rahe ho to true karein
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

const mainPageRoutes = require('./routes/mainpageroute');
app.use('/mainpage', mainPageRoutes);


// ===== Routes =====
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// ===== MongoDB Connect =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed for origins: ${allowedOrigins}`);
});
