const mongoose = require('mongoose');
const multer = require('multer');
const Permit = require('../models/permit');
const upload = multer({ dest: 'uploads/' });
const express = require('express');
const router = express.Router();
const axios = require('axios');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
require('dotenv').config();

// ================= WEATHER ROUTE =================
router.get('/weather', async (req, res) => {
  const city = req.query.city;
  if (!city) return res.status(400).json({ message: "City is required" });

  try {
    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "API key not configured" });
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const weatherResp = await axios.get(weatherUrl);
    const weatherData = weatherResp.data;

    if (!weatherData.main || !weatherData.weather) {
      return res.status(500).json({ message: "Invalid weather data received" });
    }

    const temperature = Math.round(weatherData.main.temp ?? 0);
    const feelsLike = Math.round(weatherData.main.feels_like ?? 0);
    const humidity = Math.round(weatherData.main.humidity ?? 0);
    const visibilityKm = weatherData.visibility ? (weatherData.visibility / 1000).toFixed(1) : '-';
    const windGust = Math.round(weatherData.wind?.gust || weatherData.wind?.speed || 0);
    const weatherStatus = weatherData.weather[0]?.main ?? '-';

    const { lat, lon } = weatherData.coord || {};
    let aqiIndex = null, aqiStatus = null, poValue = null;
    if (lat && lon) {
      const aqiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
      const aqiResp = await axios.get(aqiUrl);
      const aqiData = aqiResp.data?.list?.[0];
      aqiIndex = aqiData?.main?.aqi ?? null;
      poValue = aqiData?.components?.co ?? null;

      const aqiStatusMap = {
        1: "Good",
        2: "Fair",
        3: "Moderate",
        4: "Unhealthy for Sensitive Groups",
        5: "Unhealthy"
      };
      aqiStatus = aqiStatusMap[aqiIndex] || "Unknown";
    }

    const formatted = `Temperature: ${temperature}°C (Feels like ${feelsLike}°C) | Sky Status: ${weatherStatus} | Humidity: ${humidity}% | Visibility: ${visibilityKm} km | Wind Gust: ${windGust} m/s | AQI: ${aqiIndex ?? '-'} | PO: ${poValue ?? '-'} | Air Quality: ${aqiStatus ?? '-'}`;

    res.json({ formatted });

  } catch (err) {
    console.error("Weather API error:", err.message);
    res.status(500).json({ message: "Error fetching weather data" });
  }
});

// ================= AUTH MIDDLEWARE =================
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const now = Date.now();
  const idleLimit = 1000 * 60 * 5; // 5 minutes

  // Agar lastActivity set hi nahi hua, to abhi set karo
  if (!req.session.lastActivity) {
    req.session.lastActivity = now;
    return next();
  }

  if (now - req.session.lastActivity > idleLimit) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.status(440).json({ message: 'Session expired due to inactivity' });
    });
  } else {
    req.session.lastActivity = now;
    next();
  }
}

// ================= REGISTER =================
router.post('/register', async (req, res) => {
  console.log('--- SIGNUP REQUEST RECEIVED ---');

  try {
    const { username, company, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long and include at least one letter, one number, and one special character.'
      });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: 'Email is already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hash,
      company: company || '',
      lastLogin: null
    });

    // Start session only after successful registration
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: 'Session error' });

      req.session.userId = user._id;
      req.session.username = user.username;
      req.session.lastActivity = Date.now();

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          company: user.company,
          lastLogin: user.lastLogin
        }
      });
    });
  } catch (err) {
    console.error('❌ Registration error details:', err);
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
});

// ================= LOGIN =================
router.post('/login', async (req, res) => {
  console.log('--- LOGIN REQUEST RECEIVED ---');

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const previousLogin = user.lastLogin;
    user.lastLogin = new Date();
    await user.save();

    // Regenerate session after successful login
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ message: 'Session error' });

      req.session.userId = user._id;
      req.session.username = user.username;
      req.session.lastActivity = Date.now();

      res.json({
        message: 'Login successful',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          company: user.company,
          lastLogin: previousLogin || new Date()
        }
      });
    });
  } catch (err) {
    console.error('❌ Login error details:', err);
    res.status(500).json({ message: 'Something went wrong during login', error: err.message });
  }
});

// ================= PROFILE =================
router.get('/profile', requireAuth, async (req, res) => {
  const user = await User.findById(req.session.userId).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json({
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      company: user.company,
      lastLogin: user.lastLogin
    }
  });
});

// ================= LOGOUT =================
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// ================= DB CHECK =================
router.get('/db-check', (req, res) => {
  try {
    const dbName = mongoose.connection.name;
    res.json({ connectedTo: dbName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
