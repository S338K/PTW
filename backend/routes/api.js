// ================= IMPORTS =================
const mongoose = require('mongoose');
const multer = require('multer');
const PermitModel = require('../models/permit'); // renamed to avoid conflicts
const upload = multer({ dest: 'uploads/' });
const express = require('express');
const router = express.Router();
const axios = require('axios');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const crypto = require('crypto'); // added for secure token generation
const nodemailer = require('nodemailer');
require('dotenv').config();
const crypto = require('crypto');


// Mailgun client (HTTPS, works on Render free tier)
const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
});

// ================= AUTH MIDDLEWARE =================
function requireAuth(req, res, next) {
  return res.status(401).json({ message: 'Unauthorized - no session system in place' });
}

// ================= ROUTES =================

// ----- REGISTER -----
router.post('/register', async (req, res) => {
  try {
    const { username, company, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters long and include one letter, number, and special character.'
      });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: 'Email is already in use' });
    }

    // 🔹 Let the pre-save hook hash the password
    const user = new User({
      username,
      email,
      password, // plain password, will be hashed in schema
      company: company || '',
      role: role || 'Requester',
      lastLogin: null
    });

    await user.save(); // 🔹 triggers pre('save') hook for hashing

    // Session creation removed

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        company: user.company,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
});

// ----- LOGIN -----
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(400).json({ message: 'Invalid email or password' });

    // 🔹 Create session
    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.cookie.maxAge = 2 * 60 * 60 * 1000; // 2 hours, resets on login

    // Update last login
    const previousLogin = user.lastLogin;
    user.lastLogin = new Date();
    await user.save();

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        company: user.company,
        role: user.role,
        lastLogin: previousLogin || new Date()
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Something went wrong during login', error: err.message });
  }
});

// ----- PROFILE (Protected) -----
router.get('/profile', async (req, res) => {
  try {
    // 🔹 Check if session exists
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Unauthorized - session expired' });
    }

    // 🔹 Fetch user info from DB
    const user = await User.findById(req.session.userId).select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) {
      // Session exists but user no longer exists
      req.session.destroy(); // clear session
      return res.status(401).json({ message: 'Unauthorized - user not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ message: 'Unable to fetch profile', error: err.message });
  }
});

// ----- LOGOUT -----
router.post('/logout', (req, res) => {
  // Session destroy removed
  res.json({ message: 'Logged out (no session system in place)' });
});


// ===== KEEP SESSION ALIVE =====
router.get('/ping', (req, res) => {
  // Session refresh removed
  res.json({ message: 'Ping acknowledged (no session system in place)' });
});


// ===== WEATHER ROUTE =====
router.get('/weather', async (req, res) => {
  try {
    const city = req.query.city || 'Doha';
    const apiKey = process.env.WEATHER_API_KEY;

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const weatherRes = await axios.get(weatherUrl);
    const w = weatherRes.data;

    const temp = Math.round(w.main.temp);
    const feelsLike = Math.round(w.main.feels_like);
    const humidity = Math.round(w.main.humidity);
    const windSpeed = Math.round(w.wind.speed);
    const visibility = Math.round((w.visibility || 0) / 1000);
    const pressure = w.main.pressure;
    const condition = w.weather[0].description;
    const conditionIcon = `https://openweathermap.org/img/wn/${w.weather[0].icon}@2x.png`;

    const { lat, lon } = w.coord;
    const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const airRes = await axios.get(airUrl);
    const aqi = airRes.data.list[0].main.aqi;
    const aqiStatus = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' }[aqi] || 'Unknown';

    const detailsLine = `Temperature: ${temp}°C (feels like ${feelsLike}°C) | Weather status: ${condition} | Humidity: ${humidity}% | Visibility: ${visibility} km | Wind Speed: ${windSpeed} m/s | AQI: ${aqi} | Quality: ${aqiStatus}`;

    res.json({
      formatted: `${temp}°C | ${condition}`,
      detailsLine,
      temperature: temp,
      feelsLike: `${feelsLike}°C`,
      humidity: `${humidity}%`,
      visibility: `${visibility} km`,
      windSpeed: `${windSpeed} M/s`,
      pressure: `${pressure} hPa`,
      airQualityIndex: aqi,
      airQualityStatus: aqiStatus,
      condition,
      icons: {
        condition: conditionIcon,
        temperature: conditionIcon,
        feelsLike: conditionIcon,
        humidity: 'https://openweathermap.org/img/wn/50d@2x.png',
        windSpeed: 'https://openweathermap.org/img/wn/50n@2x.png',
        visibility: 'https://openweathermap.org/img/wn/01d@2x.png',
        airQuality: 'https://openweathermap.org/img/wn/04d@2x.png'
      }
    });
  } catch (err) {
    console.error('Weather fetch error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Unable to fetch weather', error: err.response?.data || err.message });
  }
});

// ===== PERMITS ROUTES =====
router.get('/permits', async (req, res) => {
  return res.status(401).json({ message: 'Unauthorized - no session system in place' });
});

router.post('/permits', async (req, res) => {
  // Auth removed — replace with token-based auth later
  return res.status(401).json({ message: 'Unauthorized - no session system in place' });
});

router.patch('/permits/:id/status', async (req, res) => {
  // Auth removed — replace with token-based auth later
  return res.status(401).json({ message: 'Unauthorized - no session system in place' });
});

// (Optional) DELETE a permit
router.delete('/permits/:id', async (req, res) => {
  // Auth removed — replace with token-based auth later
  return res.status(401).json({ message: 'Unauthorized - no session system in place' });

  /*
  try {
    const permit = await PermitModel.findOneAndDelete({
      _id: req.params.id,
      userId: req.session.userId // removed session usage
    });

    if (!permit) {
      return res.status(404).json({ message: 'Permit not found or not authorized' });
    }

    res.json({ message: 'Permit deleted successfully' });
  } catch (err) {
    console.error('Error deleting permit:', err);
    res.status(500).json({ message: 'Unable to delete permit' });
  }
  */
});

// ===== REQUEST PASSWORD RESET =====
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const genericOk = { message: 'If the email exists, a reset link will be sent' };

    const user = await User.findOne({ email });
    if (!user) return res.status(200).json(genericOk);

    const rawToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 15;
    await user.save();

    const frontendBase = process.env.FRONTEND_BASE_URL || 'https://s338k.github.io';
    const resetLink = `${frontendBase}/PTW/reset-password.html?token=${rawToken}`;

    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEV MODE] Reset link:', resetLink);
      return res.status(200).json({
        message: 'Password reset link (dev mode)',
        resetLink,
        token: rawToken
      });
    }

    try {
      const msgData = {
        from: process.env.MAILGUN_FROM,
        to: email,
        subject: 'Password Reset Request',
        text: `Click the link to reset your password: ${resetLink}`,
        html: `
          <p>Hello${user.username ? ' ' + user.username : ''},</p>
          <p>You requested to reset your password. Click the link below to reset it:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>This link will expire in 15 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
        `
      };

      const mgRes = await mg.messages.create(process.env.MAILGUN_DOMAIN, msgData);
      console.log('[Forgot Password] Email sent via Mailgun:', mgRes.id);
      return res.status(200).json(genericOk);
    } catch (mailErr) {
      console.error('[Forgot Password] Mailgun error:', mailErr);
      return res.status(200).json(genericOk);
    }
  } catch (err) {
    next(err);
  }
});

// ===== RESET PASSWORD =====
router.post('/reset-password', async (req, res) => {
  try {
    console.log('[Reset Password] Incoming:', req.body, 'Origin:', req.headers.origin);

    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const bcrypt = require('bcryptjs');
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Reset Password] Error:', err);
    res.status(500).json({
      message: process.env.NODE_ENV === 'production'
        ? 'Error resetting password'
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
  }
});

module.exports = router;
