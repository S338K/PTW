// ================= IMPORTS =================
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

// ================= AUTH MIDDLEWARE =================
// Protect routes except login & register
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const now = Date.now();
  const idleTimeout = 1000 * 60 * 15; // 15 minutes idle timeout

  // Check inactivity
  if (req.session.lastActivity && (now - req.session.lastActivity) > idleTimeout) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.status(401).json({ message: 'Session expired due to inactivity' });
    });
  } else {
    // Update last activity timestamp
    req.session.lastActivity = now;
    next();
  }
}

// ===== SESSION INITIALIZATION =====
// Called only after successful login
function createSession(req, user) {
  req.session.userId = user._id;
  req.session.username = user.username;
  req.session.lastActivity = Date.now();
}

// ================= ROUTES =================
// ----- REGISTER -----
router.post('/register', async (req, res) => {
  try {
    const { username, company, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password))
      return res.status(400).json({ message: 'Password must be at least 8 characters long and include one letter, number, and special character.' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email is already in use' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hash, company: company || '', lastLogin: null });

    // Initialize session after registration
    createSession(req, user);

    res.status(201).json({
      message: 'Registration successful',
      user: { id: user._id, username: user.username, email: user.email, company: user.company, lastLogin: user.lastLogin }
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
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const previousLogin = user.lastLogin;
    user.lastLogin = new Date();
    await user.save();

    // Initialize session after login
    createSession(req, user);

    res.json({
      message: 'Login successful',
      user: { id: user._id, username: user.username, email: user.email, company: user.company, lastLogin: previousLogin || new Date() }
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

  res.json({ user: { id: user._id, username: user.username, email: user.email, company: user.company, lastLogin: user.lastLogin } });
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

module.exports = router;