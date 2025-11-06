const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Admin = require('../models/admin');
const Approver = require('../models/approver');
const User = require('../models/user');
require('dotenv').config();
const logger = require('../logger');

// ----- REGISTER -----
router.post('/register', async (req, res) => {
  try {
    const {
      username,
      company,
      email,
      phone,
      mobile,
      password,
      role,
      buildingNo,
      floorNo,
      streetNo,
      zone,
      city,
      country,
      poBox,
    } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters long and include one letter, number, and special character.',
      });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email is already in use' });

    // Accept either `phone` or `mobile` from different frontends/forms
    const phoneVal = (phone && phone.trim()) || (mobile && mobile.trim()) || '';

    const newUser = new User({
      username,
      email,
      phone: phoneVal,
      password, // plain text here, pre-save hook will hash it
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
        poBox: poBox || '',
      },
    });

    await newUser.save();
    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        company: newUser.company,
        phone: newUser.phone,
        role: newUser.role,
        lastLogin: newUser.lastLogin,
        officeAddress: newUser.officeAddress,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Registration error');
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
});

// ----- LOGIN -----
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        field: !email ? 'email' : 'password',
        message: 'Email address and password are required',
      });
    }

    // 🔎 Try each collection in turn
    let account = await Admin.findOne({ email });
    if (!account) account = await Approver.findOne({ email });
    if (!account) account = await User.findOne({ email });

    if (!account) {
      return res.status(400).json({
        field: 'email',
        message: 'Please enter a valid email address.',
      });
    }

    // Debug logging
    logger.debug(
      {
        emailFromBody: email,
        passwordProvided: !!password,
        accountRole: account.role,
        accountHasPassword: !!account.password,
        accountPasswordSample: account.password ? account.password.slice(0, 20) + '...' : null,
      },
      'Login attempt'
    );

    // ✅ Compare using schema method
    const passwordMatch = await account.comparePassword(password);
    if (!passwordMatch) {
      return res.status(400).json({
        field: 'password',
        message: 'Please enter a valid password.',
      });
    }

    // ---- Single active-session enforcement ----
    // Detect client info for context
    const userAgent = req.headers['user-agent'] || '';
    let clientIp = null;
    try {
      const xff = req.headers['x-forwarded-for'];
      if (xff) clientIp = String(xff).split(',')[0].trim();
      if (!clientIp && req.headers['cf-connecting-ip']) clientIp = req.headers['cf-connecting-ip'];
      if (!clientIp && req.headers['x-real-ip']) clientIp = req.headers['x-real-ip'];
      if (!clientIp && req.socket && req.socket.remoteAddress) clientIp = req.socket.remoteAddress;
      if (!clientIp && req.ip) clientIp = req.ip;
    } catch (_) { clientIp = req.ip || null; }

    const displayName = account.fullName || account.username || account.email;

    // If there's an existing active session for this account, and it's still live, block unless force=true
    if (account.activeSessionId) {
      try {
        await new Promise((resolve) => {
          req.sessionStore.get(account.activeSessionId, (_err, sess) => {
            // If session exists and is not the same as current (new) session id, it's an active conflict
            const hasConflict = !!sess && account.activeSessionId !== req.sessionID;
            if (hasConflict && !req.body.force) {
              return res.status(409).json({
                code: 'ACTIVE_SESSION',
                message: `You're already signed in as ${displayName} on another device or browser. Continue here to sign out there and use this device instead?`,
                user: { displayName },
              });
            }
            // If force requested and a prior session exists, destroy it
            if (hasConflict && req.body.force) {
              req.sessionStore.destroy(account.activeSessionId, () => resolve());
              return;
            }
            resolve();
          });
        });
      } catch (e) {
        // ignore store errors; proceed with login
      }
    }

    // 🔑 Set session values
    req.session.userId = account._id;
    req.session.userRole = account.role;
    req.session.cookie.maxAge = 2 * 60 * 60 * 1000; // 2 hours

    // Save previous login before updating
    const previousLogin = account.lastLogin;

    // Move lastLogin → prevLogin
    account.prevLogin = previousLogin;

    // Update lastLogin to now
    account.lastLogin = new Date();
    await account.save();

    req.session.save(async (err) => {
      if (err) {
        logger.error({ err }, 'Session save error');
        return res.status(500).json({ message: 'Failed to save session' });
      }

      // Record this session as the active one on the account
      try {
        account.activeSessionId = req.sessionID;
        account.activeSessionCreatedAt = new Date();
        account.activeSessionUserAgent = userAgent;
        account.activeSessionIp = clientIp;
        await account.save();
      } catch (e) {
        logger.warn({ e }, 'Failed to persist activeSession metadata');
      }

      res.json({
        message: 'Login successful',
        user: {
          id: account._id,
          username: account.username, // use username consistently
          email: account.email,
          company: account.company,
          role: account.role,
          // current login time (just saved)
          lastLogin: account.lastLogin?.toISOString(),
          // previous login time (if any)
          prevLogin: previousLogin ? previousLogin.toISOString() : account.lastLogin?.toISOString(),
        },
      });
    });
  } catch (err) {
    logger.error({ err }, 'Login error');
    res.status(500).json({
      message: 'Something went wrong, try again',
      error: err.message,
    });
  }
});

// ----- PROFILE -----
router.get('/profile', async (req, res) => {
  try {
    if (!req.session.userId)
      return res.status(401).json({ message: 'Unauthorized - session expired' });

    // Fetch from the appropriate collection depending on role. Previously we only
    // queried User which caused approver/admin sessions to appear invalid and get destroyed.
    let user = null;
    const role = req.session.userRole;
    if (role === 'Admin') {
      const Admin = require('../models/admin');
      user = await Admin.findById(req.session.userId).select('-password');
    } else if (role === 'Approver' || role === 'PreApprover') {
      const Approver = require('../models/approver');
      user = await Approver.findById(req.session.userId).select('-password');
    } else {
      user = await User.findById(req.session.userId).select(
        '-password -resetPasswordToken -resetPasswordExpires'
      );
    }

    if (!user) {
      // if user not found in expected collection, try a broad search (safety)
      const Admin = require('../models/admin');
      const Approver = require('../models/approver');
      user =
        (await User.findById(req.session.userId).select(
          '-password -resetPasswordToken -resetPasswordExpires'
        )) ||
        (await Approver.findById(req.session.userId).select('-password')) ||
        (await Admin.findById(req.session.userId).select('-password'));
    }

    if (!user) {
      req.session.destroy();
      return res.status(401).json({ message: 'Unauthorized - user not found' });
    }

    // Provide client IP (prefer common proxy headers, then socket remote address)
    // Order: X-Forwarded-For (first entry), CF-Connecting-IP, X-Real-IP, socket.remoteAddress, req.ip
    let clientIp = null;
    try {
      const xff = req.headers['x-forwarded-for'];
      if (xff) {
        // may contain a list of IPs
        clientIp = String(xff).split(',')[0].trim();
      }
      if (!clientIp && req.headers['cf-connecting-ip']) clientIp = req.headers['cf-connecting-ip'];
      if (!clientIp && req.headers['x-real-ip']) clientIp = req.headers['x-real-ip'];
      if (!clientIp && req.socket && req.socket.remoteAddress) clientIp = req.socket.remoteAddress;
      if (!clientIp && req.ip) clientIp = req.ip;
    } catch (e) {
      clientIp = req.ip || null;
    }
    // Build a safe user payload to avoid leaking sensitive fields
    const safeUser = user.toObject ? user.toObject() : { ...user };
    safeUser.profileUpdatedAt = safeUser.profileUpdatedAt ? safeUser.profileUpdatedAt.toISOString() : null;
    safeUser.passwordUpdatedAt = safeUser.passwordUpdatedAt ? safeUser.passwordUpdatedAt.toISOString() : null;

    // Log client IP and source for debugging (helps confirm the running server has this code)
    try {
      const ipSource = req.headers['x-forwarded-for'] ? 'x-forwarded-for' : (req.headers['cf-connecting-ip'] ? 'cf-connecting-ip' : (req.headers['x-real-ip'] ? 'x-real-ip' : (req.socket && req.socket.remoteAddress ? 'socket.remoteAddress' : (req.ip ? 'req.ip' : 'unknown'))));
      logger.debug({ clientIp, ipSource }, 'Profile response - client IP detected');
    } catch (e) {
      // ignore logging errors
    }

    res.json({
      user: safeUser,
      session: { id: req.session.userId, role: req.session.userRole },
      clientIp
    });
  } catch (err) {
    logger.error({ err }, 'Profile fetch error');
    res.status(500).json({ message: 'Unable to fetch profile', error: err.message });
  }
});

// ----- LOGOUT -----
router.post('/logout', (req, res) => {
  const currentSessionId = req.sessionID;
  const role = req.session && req.session.userRole;
  const userId = req.session && req.session.userId;
  req.session.destroy(async (err) => {
    if (err) {
      logger.error({ err }, 'Logout error');
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('sessionId', {
      httpOnly: true,
      sameSite: 'none',
      secure: process.env.NODE_ENV === 'production',
    });
    // best-effort: clear activeSessionId on the account if it matches this session
    try {
      if (userId && role) {
        if (role === 'Admin') {
          const Admin = require('../models/admin');
          await Admin.updateOne({ _id: userId, activeSessionId: currentSessionId }, { $unset: { activeSessionId: 1, activeSessionCreatedAt: 1, activeSessionUserAgent: 1, activeSessionIp: 1 } });
        } else if (role === 'Approver' || role === 'PreApprover') {
          const Approver = require('../models/approver');
          await Approver.updateOne({ _id: userId, activeSessionId: currentSessionId }, { $unset: { activeSessionId: 1, activeSessionCreatedAt: 1, activeSessionUserAgent: 1, activeSessionIp: 1 } });
        } else {
          await User.updateOne({ _id: userId, activeSessionId: currentSessionId }, { $unset: { activeSessionId: 1, activeSessionCreatedAt: 1, activeSessionUserAgent: 1, activeSessionIp: 1 } });
        }
      }
    } catch (e) {
      logger.warn('Failed to clear activeSession on logout:', e && e.message);
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// ----- FORGOT PASSWORD -----
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
      logger.debug({ resetLink, token: rawToken }, '[DEV MODE] Reset link');
      return res
        .status(200)
        .json({ message: 'Password reset link (dev mode)', resetLink, token: rawToken });
    }
    return res.status(200).json(genericOk);
  } catch (err) {
    next(err);
  }
});

// ----- RESET PASSWORD -----
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
      return res.status(400).json({ message: 'Token and new password are required' });

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      return res
        .status(400)
        .json({
          message:
            'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
        });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = newPassword; // plain text, pre-save hook will hash
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    logger.error({ err }, '[Reset Password] Error');
    res.status(500).json({ message: 'Error resetting password', error: err.message });
  }
});

// ----- CHECK CURRENT PASSWORD (authenticated users) -----
router.post('/check-password', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const { currentPassword } = req.body || {};
    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required' });
    }

    // Locate the account in the correct collection depending on role
    let account = null;
    const role = req.session.userRole;
    if (role === 'Admin') {
      const Admin = require('../models/admin');
      account = await Admin.findById(req.session.userId);
    } else if (role === 'Approver' || role === 'PreApprover') {
      const Approver = require('../models/approver');
      account = await Approver.findById(req.session.userId);
    } else {
      account = await User.findById(req.session.userId);
    }

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const ok = await account.comparePassword(currentPassword);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
    return res.json({ valid: true });
  } catch (err) {
    logger.error({ err }, '[Check Password] Error');
    res.status(500).json({ message: 'Error checking password', error: err.message });
  }
});

// ----- UPDATE PASSWORD (authenticated users) -----
router.put('/update-password', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    // Password validation: 8+ chars, at least 1 upper, 1 lower, 1 digit, 1 special
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character'
      });
    }

    // Locate the account in the correct collection depending on role
    let account = null;
    const role = req.session.userRole;
    if (role === 'Admin') {
      const Admin = require('../models/admin');
      account = await Admin.findById(req.session.userId);
    } else if (role === 'Approver' || role === 'PreApprover') {
      const Approver = require('../models/approver');
      account = await Approver.findById(req.session.userId);
    } else {
      account = await User.findById(req.session.userId);
    }

    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Verify current password
    const passwordMatch = await account.comparePassword(currentPassword);
    if (!passwordMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password (pre-save hook will hash it)
    account.password = newPassword;
    account.passwordUpdatedAt = new Date();
    const pwdRemark = req.body.remark;
    if (pwdRemark) {
      account.passwordUpdateLogs = account.passwordUpdateLogs || [];
      account.passwordUpdateLogs.push({ remark: pwdRemark, updatedAt: new Date() });
    }
    await account.save();

    logger.info({ userId: account._id }, 'Password updated successfully');
    res.json({ message: 'Password updated successfully', passwordUpdatedAt: account.passwordUpdatedAt });
  } catch (err) {
    logger.error({ err }, '[Update Password] Error');
    res.status(500).json({ message: 'Error updating password', error: err.message });
  }
});

// ----- UPDATE PROFILE (authenticated users) -----
router.put('/update-profile', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { username, email, company, phone, remark } = req.body;

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only allow phone updates from self-service for non-admins; admins may change username/email/company
    if (req.session.userRole === 'Admin') {
      // If admin provided username/email, validate
      if (!username || !email) {
        return res.status(400).json({ message: 'Username and email are required' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return res.status(400).json({ message: 'Invalid email format' });
      if (email !== user.email) {
        const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
        if (existingUser) return res.status(409).json({ message: 'Email is already in use by another account' });
      }
      user.username = username;
      user.email = email;
      user.company = company || '';
    }

    // Always allow updating phone
    user.phone = phone || user.phone || '';
    user.profileUpdatedAt = new Date();

    if (remark) {
      user.profileUpdateLogs = user.profileUpdateLogs || [];
      user.profileUpdateLogs.push({ remark: remark, updatedAt: new Date() });
    }

    await user.save();

    logger.info({ userId: user._id }, 'Profile updated successfully');

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        company: user.company,
        phone: user.phone,
        role: user.role,
        profileUpdatedAt: user.profileUpdatedAt
      }
    });
  } catch (err) {
    logger.error({ err }, '[Update Profile] Error');
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
});

module.exports = router;
