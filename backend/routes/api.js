// ================= IMPORTS =================
const mongoose = require('mongoose');
const multer = require('multer');
const PermitModel = require('../models/permit'); // renamed to avoid conflicts
const express = require('express');
const router = express.Router();
const axios = require('axios');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const crypto = require('crypto'); // added for secure token generation
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
require('dotenv').config();


// ================= AUTH MIDDLEWARE =================
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    // Session exists, user is authenticated
    return next();
  } else {
    return res.status(401).json({ message: 'Unauthorized - please log in' });
  }
}
module.exports = requireAuth;

// ================= ROUTES =================

// ----- REGISTER -----
router.post('/register', async (req, res) => {
  try {
    const {
      username, company, email, password, role, buildingNo, floorNo, streetNo, zone, city, country, poBox } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters long and include one letter, number, and special character.'
      });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: 'Email is already in use' });
    }

    const user = new User({
      username,
      email,
      password, // plain password, will be hashed in schema
      company: company || '',
      role: role || 'Requester',
      lastLogin: null,
      officeAddress: {
        buildingNo: buildingNo || '',
        floorNo: floorNo || '',
        streetNo: streetNo || '',
        zone: zone || '',
        city: city || '',
        country: country || '',
        poBox: poBox || ''
      }
    });

    await user.save();

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        company: user.company,
        role: user.role,
        lastLogin: user.lastLogin,
        officeAddress: user.officeAddress
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

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(400).json({ message: 'Invalid email or password' });

    // 🔹 Create session
    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.cookie.maxAge = 2 * 60 * 60 * 1000; // 2 hours

    const previousLogin = user.lastLogin;
    user.lastLogin = new Date();
    await user.save();

    // 🔹 Save session before sending response
    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Failed to save session' });
      }

      res.json({
        message: 'Login successful',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          company: user.company,
          role: user.role,
          lastLogin: previousLogin ? previousLogin.toISOString() : new Date().toISOString()
        }
      });
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Something went wrong during login', error: err.message });
  }
});

// ----- PROFILE (Protected) -----
router.get('/profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Unauthorized - session expired' });
    }

    const user = await User.findById(req.session.userId)
      .select('-password -resetPasswordToken -resetPasswordExpires');
    if (!user) {
      req.session.destroy();
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
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }

    // Clear the cookie on the client
    res.clearCookie('sessionId', {
      httpOnly: true,
      sameSite: 'none',
      secure: process.env.NODE_ENV === 'production' // ✅ secure only in prod
    });

    res.json({ message: 'Logged out successfully' });
  });
});

// ===== KEEP SESSION ALIVE =====
router.get('/ping', (req, res) => {
  if (req.session && req.session.userId) {
    // Optionally refresh expiry
    req.session.touch();
    return res.json({ message: 'Session is alive' });
  }
  res.status(401).json({ message: 'Session expired' });
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

    res.json({
      formatted: `${temp}°C | ${condition}`,
      temperature: temp,
      condition,
      detailsLine: `Temperature: ${temp}°C (feels like ${feelsLike}°C) | Weather status: ${condition} | Humidity: ${humidity}% | Visibility: ${visibility} km | Wind Speed: ${windSpeed} m/s | AQI: ${aqi} | Quality: ${aqiStatus}`,
      icons: { condition: conditionIcon }
    });
  } catch (err) {
    console.error('Weather fetch error:', err.response?.data || err.message);
    res.status(500).json({ message: 'Unable to fetch weather', error: err.response?.data || err.message });
  }
});

// ===== PERMITS ROUTES =====
const Permit = require('../models/permit'); // your Permitdata model

// GET all permits for the logged-in user
router.get('/permit', requireAuth, async (req, res) => {
  try {
    const permits = await Permit.find({ requester: req.session.userId }).sort({ createdAt: -1 });
    res.json(permits);
  } catch (err) {
    console.error('Error fetching permits:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET a single permit by ID
router.get('/permit/:id', requireAuth, async (req, res) => {
  try {
    const permit = await Permit.findOne({ _id: req.params.id, requester: req.session.userId });
    if (!permit) return res.status(404).json({ message: 'Permit not found' });
    res.json(permit);
  } catch (err) {
    console.error('Error fetching permit:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ==========================
// Multer memory storage
// ==========================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ==========================
// POST /api/permit
// ==========================
router.post('/permit', requireAuth, upload.array('files', 5), async (req, res) => {
  try {
    // Map uploaded files into schema format
    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      data: file.buffer   // 🔹 store file binary directly in MongoDB
    }));

    // Build permit document
    const permit = new Permit({
      fullName: req.body.fullName,
      lastName: req.body.lastName,
      contactDetails: req.body.contactDetails,
      altContactDetails: req.body.altContactDetails,
      corpEmailId: req.body.corpEmailId,
      terminal: req.body.terminal,
      facility: req.body.facility,
      specifyTerminal: req.body.specifyTerminal,
      specifyFacility: req.body.specifyFacility,
      workDescription: req.body.workDescription,
      impact: req.body.impact,
      equipmentTypeInput: req.body.equipmentTypeInput,
      impactDetailsInput: req.body.impactDetailsInput,
      ePermit: req.body.ePermit,
      ePermitReason: req.body.ePermitReason,
      fmmWorkorder: req.body.fmmWorkorder,
      noFmmWorkorder: req.body.noFmmWorkorder,
      hseRisk: req.body.hseRisk,
      noHseRiskAssessmentReason: req.body.noHseRiskAssessmentReason,
      opRisk: req.body.opRisk,
      noOpsRiskAssessmentReason: req.body.noOpsRiskAssessmentReason,
      startDateTime: req.body.startDateTime,
      endDateTime: req.body.endDateTime,
      signName: req.body.signName,
      signDate: req.body.signDate,
      signTime: req.body.signTime,
      designation: req.body.designation,
      files: uploadedFiles,
      // 🔹 Link to logged-in user from session
      requester: req.session.userId,
      role: req.session.userRole
    });

    await permit.save();

    res.status(201).json({
      message: 'Permit saved successfully',
      permit
    });
  } catch (err) {
    console.error('Permit save error:', err);
    res.status(500).json({
      message: 'Failed to save permit',
      error: err.message
    });
  }
});

// PATCH: update permit status
router.patch('/permit/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;

    const permit = await Permit.findOne({ _id: req.params.id, requester: req.session.userId });
    if (!permit) return res.status(404).json({ message: 'Permit not found' });

    // If approving and no permit number yet, generate one
    if (status === 'Approved' && !permit.permitNumber) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();

      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');

      const dateStr = `${dd}${mm}${yyyy}`;
      const timeStr = `${hh}${min}${ss}`;

      // Count how many approved permits exist for today
      const todayStart = new Date(yyyy, now.getMonth(), now.getDate());
      const todayEnd = new Date(yyyy, now.getMonth(), now.getDate() + 1);

      const count = await Permit.countDocuments({
        status: 'Approved',
        createdAt: { $gte: todayStart, $lt: todayEnd }
      });

      const serial = String(count + 1).padStart(3, '0');
      permit.permitNumber = `BHS-${dateStr}-${timeStr}-${serial}`;

      permit.approvedAt = new Date();
    }


    res.json({ message: 'Status updated', permit });
  } catch (err) {
    console.error('Error updating permit:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET PDF for an approved permit
router.get('/permit/:id/pdf', requireAuth, async (req, res) => {
  try {
    const permit = await Permit.findOne({
      _id: req.params.id,
      requester: req.session.userId
    });

    if (!permit) return res.status(404).json({ message: 'Permit not found' });
    if (permit.status !== 'Approved') {
      return res.status(403).json({ message: 'Permit not approved yet' });
    }

    // Fetch logged-in user details
    const user = await User.findById(req.session.userId);

    // Helper to format dates nicely: 29-Sep-2025 22:55:07
    function formatDateTime(date) {
      return new Date(date).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    }

    // Use @sparticuz/chromium + puppeteer-core
    const executablePath = await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();

    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; }
            h1 { text-align: center; margin-bottom: 20px; }
            .header { display: flex; justify-content: space-between; align-items: center; }
            .logo { width: 100px; height: auto; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            th { background: #f2f2f2; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #555; }
            .signature { margin-top: 50px; }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="https://via.placeholder.com/100x50?text=LOGO" class="logo" />
            <div>
              <strong>Permit Number:</strong> ${permit.permitNumber || '-'}<br/>
              <strong>Status:</strong> ${permit.status || '-'}
            </div>
          </div>

          <h1>Permit to Access</h1>

<table>
  <tr><th>Full Name</th><td>${permit.fullName || '-'} ${permit.lastName || ''}</td></tr>
  <tr><th>Work Description</th><td>${permit.workDescription || '-'}</td></tr>
  <tr><th>Start Date</th><td>${permit.startDateTime ? formatDateTime(permit.startDateTime) : '-'}</td></tr>
  <tr><th>End Date</th><td>${permit.endDateTime ? formatDateTime(permit.endDateTime) : '-'}</td></tr>
  <tr><th>Contact</th><td>${permit.contactDetails || '-'}</td></tr>
  <tr><th>Alternate Contact</th><td>${permit.altContactDetails || '-'}</td></tr>
  <tr><th>Terminal</th><td>${permit.terminal || '-'}</td></tr>
  <tr><th>Facility</th><td>${permit.facility || '-'}</td></tr>
  <tr><th>Submitted On</th><td>${permit.createdAt ? formatDateTime(permit.createdAt) : '-'}</td></tr>
  <tr><th>Approved On</th><td>${permit.approvedAt ? formatDateTime(permit.approvedAt) : '-'}</td></tr>
</table>


          <div class="signature">
            <p><strong>Authorized By:</strong> ____________________________</p>
            <p><strong>Date:</strong> ____________________________</p>
          </div>

          <div class="footer">
            This is a system‑generated permit. No manual signature required.
            <br/><br/>
            <em>Printed by: ${user?.fullName || 'Unknown User'} on ${formatDateTime(new Date())}</em>
          </div>
        </body>
      </html>
    `;

    console.log('=== PDF HTML START ===');
    console.log(html);
    console.log('=== PDF HTML END ===');

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('body'); // ensures body is present
    await page.evaluateHandle('document.fonts.ready'); // wait for fonts/styles

    // Tiny delay to let Chromium paint
    await new Promise(r => setTimeout(r, 300));

    await page.waitForSelector('table');  // waits until your permit table is in the DOM

    // 👉 Debug screenshot here
    await page.screenshot({ path: 'debug.png', fullPage: true });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Permit-${permit.permitNumber}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).json({ message: 'Error generating PDF' });
  }
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
      return res.status(200).json({ message: 'Password reset link (dev mode)', resetLink, token: rawToken });
    }
    return res.status(200).json(genericOk);

  } catch (err) {
    next(err);
  }
});

// ===== RESET PASSWORD =====
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('[Reset Password] Error:', err);
    res.status(500).json({ message: 'Error resetting password', error: err.message });
  }
});

module.exports = router;