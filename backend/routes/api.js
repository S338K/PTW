const express = require('express');
const router = express.Router();
const axios = require('axios');

// ✅ Mount new route modules
router.use('/', require('./auth')); // /register, /login, /logout, /profile, /forgot-password, /reset-password
router.use('/', require('./permit')); // /permit, /permit/:id, /permit (POST), /permit/:id/status, /permit/:id/pdf

// ===== KEEP SESSION ALIVE =====
router.get('/ping', (req, res) => {
  if (req.session && req.session.userId) {
    req.session.touch(); // refresh expiry
    return res.json({ message: 'Session is alive' });
  }
  res.status(401).json({ message: 'Session expired' });
});

// ===== WEATHER ROUTE =====
router.get('/weather', async (req, res) => {
  try {
    const city = req.query.city || 'Doha';
    const cfg = require('../config/config');
    const apiKey = cfg.API_KEY;
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${apiKey}&units=metric`;

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
    const aqiStatus =
      { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' }[aqi] || 'Unknown';

    res.json({
      formatted: `${temp}°C | ${condition}`,
      temperature: temp,
      condition,
      detailsLine: `Temperature: ${temp}°C (feels like ${feelsLike}°C) | Weather status: ${condition} | Humidity: ${humidity}% | Visibility: ${visibility} km | Wind Speed: ${windSpeed} m/s | AQI: ${aqi} | Quality: ${aqiStatus}`,
      icons: { condition: conditionIcon },
    });
  } catch (err) {
    console.error('Weather fetch error:', err.response?.data || err.message);
    res
      .status(500)
      .json({ message: 'Unable to fetch weather', error: err.response?.data || err.message });
  }
});

// ===== DASHBOARD STATISTICS =====
router.get('/dashboard/stats', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const Permit = require('../models/permit');

    // Get permit statistics
    const [pending, approved, rejected, total] = await Promise.all([
      Permit.countDocuments({ status: { $in: ['Pending', 'In Progress'] } }),
      Permit.countDocuments({ status: 'Approved' }),
      Permit.countDocuments({ status: 'Rejected' }),
      Permit.countDocuments({})
    ]);

    res.json({
      pending,
      approved,
      rejected,
      total,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});

// ===== PERMITS DATA =====
router.get('/permits', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const Permit = require('../models/permit');
    const { status, limit = 50, page = 1 } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const permits = await Permit.find(query)
      .populate('requester', 'username email')
      .populate('preApprovedBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Permit.countDocuments(query);

    res.json({
      permits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Permits fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch permits' });
  }
});

// Get single permit details
router.get('/permit/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const Permit = require('../models/permit');
    const permit = await Permit.findById(req.params.id)
      .populate('requester', 'username email fullName')
      .populate('preApprovedBy', 'username email fullName')
      .populate('approvedBy', 'username email fullName');

    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    res.json(permit);
  } catch (error) {
    console.error('Error fetching permit details:', error);
    res.status(500).json({ error: 'Failed to fetch permit details' });
  }
});

// ===== DEBUG ENDPOINT (no auth required) =====
router.get('/debug/permits', async (req, res) => {
  try {
    const Permit = require('../models/permit');
    const permits = await Permit.find({}).limit(10);
    const stats = {
      total: await Permit.countDocuments({}),
      pending: await Permit.countDocuments({ status: { $in: ['Pending', 'In Progress'] } }),
      approved: await Permit.countDocuments({ status: 'Approved' }),
      rejected: await Permit.countDocuments({ status: 'Rejected' })
    };

    res.json({
      message: 'Debug data (no auth required)',
      stats,
      samplePermits: permits.slice(0, 3).map(p => ({
        id: p._id,
        title: p.permitTitle,
        status: p.status,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
