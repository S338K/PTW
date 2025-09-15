const mongoose = require('mongoose');
const multer = require('multer');
const Permit = require('../models/permit');
const upload = multer({ dest: 'uploads/' }); // basic storage, customize if needed
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

    // Weather API call
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

    // AQI API call
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

// ================= AUTH ROUTES =================
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

router.post('/register', async (req, res) => {
  console.log('--- SIGNUP REQUEST RECEIVED ---');
  console.log('Incoming body:', req.body);

  try {
    const { username, company, email, password } = req.body;
    console.log('Parsed fields:', { username, company, email, passwordLength: password?.length });

    if (!username || !email || !password) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ message: 'All fields are required' });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      console.log('❌ Password regex failed');
      return res.status(400).json({
        message: 'Password must be at least 8 characters long and include at least one letter, one number, and one special character.'
      });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      console.log('❌ Email already in use');
      return res.status(409).json({ message: 'Email is already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed');

    const user = await User.create({
      username,
      email,
      password: hash,
      company: company || '',
      lastLogin: null
    });

    console.log('✅ User created with ID:', user._id);

    req.session.userId = user._id;
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
  } catch (err) {
    console.error('❌ Registration error details:', err);
    res.status(500).json({
      message: 'Something went wrong',
      error: err.message,
      stack: err.stack
    });
  }
});

router.post('/login', async (req, res) => {
  console.log('--- LOGIN REQUEST RECEIVED ---');
  console.log('Incoming body:', req.body);

  try {
    const { email, password } = req.body;
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ No user found for email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      console.log('❌ Password mismatch for email:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const previousLogin = user.lastLogin;
    user.lastLogin = new Date();
    await user.save();

    req.session.userId = user._id;
    console.log('✅ Login successful for user ID:', user._id);

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
  } catch (err) {
    console.error('❌ Login error details:', err);
    res.status(500).json({
      message: 'Something went wrong during login',
      error: err.message,
      stack: err.stack
    });
  }
});


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

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

router.get('/db-check', (req, res) => {
  try {
    const dbName = mongoose.connection.name; // current DB ka naam
    res.json({ connectedTo: dbName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
