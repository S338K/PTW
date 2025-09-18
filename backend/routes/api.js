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

// ================= AUTH MIDDLEWARE =================
function requireAuth(req, res, next) {
  console.log('--- requireAuth Middleware ---');
  if (!req.session || !req.session.userId) {
    console.log('No session or userId found. Unauthorized.');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const now = Date.now();
  const idleTimeout = 1000 * 60 * 15; // 15 minutes
  const absoluteTimeout = 1000 * 60 * 60 * 2; // 2 hours

  console.log('Session info:', {
    sessionStart: req.session.sessionStart,
    lastActivity: req.session.lastActivity,
    now,
    idleDiff: now - (req.session.lastActivity || 0),
    absoluteDiff: now - (req.session.sessionStart || 0)
  });

  // Absolute timeout
  if (req.session.sessionStart && (now - req.session.sessionStart) > absoluteTimeout) {
    console.log('Session expired (absolute timeout). Destroying session...');
    req.session.destroy(() => {
      console.log('Session destroyed due to absolute timeout');
      res.clearCookie('connect.sid');
      return res.status(401).json({ message: 'Session expired (absolute timeout)' });
    });
    
    return;
  }

  // Idle timeout
  if (req.session.lastActivity && (now - req.session.lastActivity) > idleTimeout) {
    console.log('Session expired due to inactivity. Destroying session...');
    req.session.destroy(() => {
      console.log('Session destroyed due to inactivity');
      res.clearCookie('connect.sid');
      return res.status(401).json({ message: 'Session expired due to inactivity' });
    });
    return;
  }

  // Update last activity
  req.session.lastActivity = now;
  console.log('Session lastActivity updated to', now);
  next();
}

// ===== SESSION INITIALIZATION =====
function createSession(req, user) {
  req.session.userId = user._id;
  req.session.username = user.username;
  req.session.lastActivity = Date.now();
  req.session.sessionStart = Date.now();

  // Session cookie expires on browser close
  //req.session.cookie.expires = false;
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

    createSession(req, user); // your existing session logic

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

    console.log('Login attempt:', email, password); // 👈 Log incoming email & password

    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ No user found for email:', email); // 👈 Log if user is not found
      return res.status(400).json({ message: 'Invalid username' });
    }

    console.log('✅ User found. Stored hash:', user.password); // 👈 Log stored hash

    const ok = await bcrypt.compare(password, user.password);

    console.log('🔍 Password match result:', ok); // 👈 Log the result of the password check

    if (!ok) return res.status(400).json({ message: 'Invalid password' });

    const previousLogin = user.lastLogin;
    user.lastLogin = new Date();
    await user.save();

    createSession(req, user);

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
router.get('/profile', requireAuth, async (req, res) => {
  const user = await User.findById(req.session.userId).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.json({ user: { id: user._id, username: user.username, email: user.email, company: user.company, role: user.role, lastLogin: user.lastLogin } });
});

// ----- LOGOUT -----
router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out' });
    });
  } else {
    res.json({ message: 'No active session' });
  }
});

// ===== KEEP SESSION ALIVE =====
router.get('/ping', requireAuth, (req, res) => {
  req.session.lastActivity = Date.now();
  res.json({ message: 'Session refreshed' });
});

// ===== WEATHER ROUTE =====
router.get('/weather', async (req, res) => {
  try {
    const city = req.query.city || 'Doha';
    const apiKey = process.env.WEATHER_API_KEY;

    // Current weather
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

    // Air quality
    const { lat, lon } = w.coord;
    const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const airRes = await axios.get(airUrl);
    const aqi = airRes.data.list[0].main.aqi;
    const aqiStatus = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' }[aqi] || 'Unknown';

    // Build details line (no PO)
    const detailsLine = `Temperature: ${temp}°C (feels like ${feelsLike}°C) | Weather status: ${condition} | Humidity: ${humidity}% | Visibility: ${visibility} km | Wind Speed: ${windSpeed} m/s | AQI: ${aqi} | Quality: ${aqiStatus}`;

    res.json({
      formatted: `${temp}°C | ${condition}`,
      detailsLine,
      temperature: temp,
      feelsLike: `${feelsLike}°C`,
      humidity: `${humidity}%`,
      visibility: `${visibility} km`,
      windSpeed: `${windSpeed} m/s`,
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

// GET all permits for logged-in user
router.get('/permits', requireAuth, async (req, res) => {
  try {
    const userPermits = await PermitModel.find({ userId: req.session.userId })
      .sort({ submittedAt: -1 });

    res.json(userPermits.map(p => ({
      submittedAt: p.submittedAt,
      permitNumber: p.permitNumber,
      title: p.title,
      status: p.status
    })));
  } catch (err) {
    console.error('Error fetching permits:', err);
    res.status(500).json({ message: 'Unable to fetch permits' });
  }
});

// POST create a new permit
router.post('/permits', requireAuth, async (req, res) => {
  try {
    const { permitNumber, title } = req.body;
    if (!permitNumber || !title) {
      return res.status(400).json({ message: 'Permit number and title are required' });
    }

    const permit = await PermitModel.create({
      userId: req.session.userId,
      permitNumber,
      title,
      status: 'Pending',
      submittedAt: new Date()
    });

    res.status(201).json({ message: 'Permit submitted successfully', permit });
  } catch (err) {
    console.error('Error creating permit:', err);
    res.status(500).json({ message: 'Unable to submit permit' });
  }
});

// PATCH update permit status (with role checks)
router.patch('/permits/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Pending', 'In Progress', 'Approved'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ message: 'User not found' });

    // Role-based permissions
    if (user.role === 'PreApprover' && status !== 'In Progress') {
      return res.status(403).json({ message: 'Pre-Approver can only set status to In Progress' });
    }
    if (user.role === 'FinalApprover' && status !== 'Approved') {
      return res.status(403).json({ message: 'Final Approver can only set status to Approved' });
    }
    if (user.role === 'Requester') {
      return res.status(403).json({ message: 'Requester cannot change status' });
    }
    // Admin can set any status

    const permit = await PermitModel.findById(req.params.id);
    if (!permit) {
      return res.status(404).json({ message: 'Permit not found' });
    }

    permit.status = status;
    await permit.save();

    res.json({ message: 'Status updated successfully', permit });
  } catch (err) {
    console.error('Error updating permit status:', err);
    res.status(500).json({ message: 'Unable to update permit status' });
  }
});

// (Optional) DELETE a permit
router.delete('/permits/:id', requireAuth, async (req, res) => {
  try {
    const permit = await PermitModel.findOneAndDelete({
      _id: req.params.id,
      userId: req.session.userId
    });

    if (!permit) {
      return res.status(404).json({ message: 'Permit not found or not authorized' });
    }

    res.json({ message: 'Permit deleted successfully' });
  } catch (err) {
    console.error('Error deleting permit:', err);
    res.status(500).json({ message: 'Unable to delete permit' });
  }
});

// ===== PASSWORD RESET ROUTES (secure hashed token) =====

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account with that email' });

    // Generate raw token
    const rawToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Save hashed token + expiry in DB
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 15; // 15 min expiry
    await user.save();

    // Create reset link (point this to your frontend reset page)
    const resetLink = `https://your-frontend-domain.com/reset-password?token=${rawToken}`;

    // Configure Outlook SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.OUTLOOK_USER, // Outlook email
        pass: process.env.OUTLOOK_PASS  // Outlook password or app password
      }
    });

    // Email content
    const mailOptions = {
      from: `"PTW Support" <${process.env.OUTLOOK_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>Hello ${user.username || ''},</p>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.json({ message: 'Password reset email sent successfully' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Error generating reset token' });
  }
});

// Reset password
// ===== RESET PASSWORD =====
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // ✅ Strong password regex: min 8 chars, uppercase, lowercase, number, special char
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
      });
    }

    // Hash the token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Error resetting password' });
  }
});


module.exports = router;
