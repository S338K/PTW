const express = require('express');
const Approver = require('../models/approver');
const Admin = require('../models/admin');
const User = require('../models/user');
const Permit = require('../models/permit');

const router = express.Router();

// Middleware to ensure only Admins can access these routes
function requireAdmin(req, res, next) {
  if (req.session && req.session.userRole === 'Admin') {
    return next();
  }
  return res.status(403).json({ error: 'Unauthorized' });
}

// Apply to all routes in this file
router.use(requireAdmin);

// POST /admin/register-user
router.post('/register-user', async (req, res) => {
  // register-user: no debug logging here

  try {
    if (process.env.NODE_ENV !== 'production') console.debug('[DEBUG] /admin/register-user req.body=', req.body);
    const { fullName, email, mobile, company, department, designation, password, role } = req.body;
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[DEBUG] /admin/register-user body role=', role);
    }

    // Basic validation
    if (!fullName || !email || !mobile || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Defensive normalization: accept hyphenated or spaced variants and normalize to canonical values
    let normalizedRole = role;
    if (typeof normalizedRole === 'string') {
      const r = normalizedRole.trim().toLowerCase();
      if (process.env.NODE_ENV !== 'production') console.debug('[DEBUG] normalized role input lower=', r);
      if (r === 'pre-approver' || r === 'preapprover' || r === 'pre approver')
        normalizedRole = 'PreApprover';
      else if (r === 'approver') normalizedRole = 'Approver';
      else if (r === 'admin') normalizedRole = 'Admin';
      else if (r === 'requester' || r === 'user') normalizedRole = 'Requester';
    }
    if (process.env.NODE_ENV !== 'production') console.debug('[DEBUG] normalizedRole after mapping=', normalizedRole);

    if (normalizedRole === 'Admin') {
      const exists = await Admin.findOne({ email });
      if (exists) return res.status(409).json({ error: 'Email already exists' });

      const admin = new Admin({
        fullName,
        email,
        mobile,
        company,
        department,
        designation,
        password, // pre-save hook will hash
        role: 'Admin',
      });
      await admin.save();
    } else if (normalizedRole === 'PreApprover' || normalizedRole === 'Approver') {
      const exists = await Approver.findOne({ email });
      if (exists) return res.status(409).json({ error: 'Email already exists' });

      const approver = new Approver({
        fullName,
        email,
        mobile,
        company,
        department,
        designation,
        password, // pre-save hook will hash
        role: normalizedRole,
      });
      await approver.save();
    } else {
      // Allow creating Requester (User) accounts via admin panel
      if (String(normalizedRole).toLowerCase() === 'requester' || String(role).toLowerCase() === 'requester') {
        // ensure email isn't used by any account type
        const existsAny = (await Admin.findOne({ email })) || (await Approver.findOne({ email })) || (await User.findOne({ email }));
        if (existsAny) return res.status(409).json({ error: 'Email already exists' });
        const user = new User({
          fullName,
          username: fullName,
          email,
          mobile,
          company,
          department,
          designation,
          password,
          role: 'Requester',
        });
        await user.save();
      } else {
        return res.status(400).json({ error: 'Invalid role' });
      }
    }

    res.status(201).json({ message: `${role} registered successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /admin/users
router.get('/users', async (req, res) => {
  try {
    const approvers = await Approver.find().lean();
    const admins = await Admin.find().lean();
    // Include Requester (User) accounts as well so the admin UI can show the full user list
    const requesters = await User.find().lean();

    const normalize = (u, source) => ({
      id: u._id,
      username: u.fullName || u.username || '—',
      email: u.email || '',
      phone: u.mobile || u.phone || u.mobileNumber || u.phoneNumber || '',
      company: u.company || '',
      role: u.role || (source === 'User' ? 'Requester' : u.role || '—'),
      status: u.status || u.userStatus || 'Active',
      registered: u.createdAt ? u.createdAt.toISOString().split('T')[0] : '—',
      lastLogin: u.lastLogin ? u.lastLogin.toISOString().split('T')[0] : '—',
      source: source,
    });

    // Order: Approvers, Admins, then Requesters
    const users = [
      ...approvers.map((u) => normalize(u, 'Approver')),
      ...admins.map((u) => normalize(u, 'Admin')),
      ...requesters.map((u) => normalize(u, 'User')),
    ];
    res.json(users);
  } catch (err) {
    console.error('Error loading users:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// GET /admin/stats
router.get('/stats', async (req, res) => {
  try {
    const totalAdmins = await Admin.countDocuments();
    const activeAdmins = await Admin.countDocuments({ status: 'Active' });
    const inactiveAdmins = await Admin.countDocuments({ status: 'Inactive' });

    const totalApprovers = await Approver.countDocuments();
    const activeApprovers = await Approver.countDocuments({ status: 'Active' });
    const inactiveApprovers = await Approver.countDocuments({ status: 'Inactive' });

    const totalRequesters = await User.countDocuments();
    const activeRequesters = await User.countDocuments({ userStatus: 'Active' });
    const inactiveRequesters = await User.countDocuments({ userStatus: 'Inactive' });

    const preApprovers = await Approver.countDocuments({ role: 'PreApprover' });
    const approvers = await Approver.countDocuments({ role: 'Approver' });

    res.json({
      totalUsers: totalAdmins + totalApprovers + totalRequesters,
      activeUsers: activeAdmins + activeApprovers + activeRequesters,
      inactiveUsers: inactiveAdmins + inactiveApprovers + inactiveRequesters,
      admins: totalAdmins,
      preApprovers,
      approvers,
    });
  } catch (err) {
    console.error('Error loading stats:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// GET /admin/roles - return allowed roles for the admin UI
router.get('/roles', (req, res) => {
  try {
    const roles = [
      { value: 'admin', label: 'Admin' },
      { value: 'approver', label: 'Approver' },
      { value: 'pre-approver', label: 'Pre-Approver' },
      { value: 'requester', label: 'Requester' },
    ];
    res.json(roles);
  } catch (err) {
    console.error('Error loading roles', err);
    res.status(500).json({ error: 'Failed to load roles' });
  }
});

// GET /admin/reports?period=daily|weekly|monthly
router.get('/reports', async (req, res) => {
  try {
    const period = String(req.query.period || 'daily').toLowerCase();
    const now = new Date();
    let start = new Date(now);
    if (period === 'weekly') {
      start.setDate(now.getDate() - 7);
    } else if (period === 'monthly') {
      start.setMonth(now.getMonth() - 1);
    } else {
      // default: daily (last 24 hours)
      start.setDate(now.getDate() - 1);
    }

    // Normalize start to begin of day for clarity
    start.setHours(0, 0, 0, 0);

    // Aggregate counts
    const totalPermits = await Permit.countDocuments();
    const createdInPeriod = await Permit.countDocuments({ createdAt: { $gte: start } });
    const pending = await Permit.countDocuments({ status: { $in: ['Pending'] }, createdAt: { $gte: start } });
    const inProgress = await Permit.countDocuments({ status: 'In Progress', createdAt: { $gte: start } });
    const approved = await Permit.countDocuments({ status: 'Approved', createdAt: { $gte: start } });
    const rejected = await Permit.countDocuments({ status: 'Rejected', createdAt: { $gte: start } });

    // Also include approvals within period (approvedAt)
    const approvedAtPeriod = await Permit.countDocuments({ approvedAt: { $gte: start } });

    // Build CSV rows
    const rows = [
      ['Report Period', period],
      ['Generated At', now.toISOString()],
      [],
      ['Metric', 'Value'],
      ['Total Permits (all time)', totalPermits],
      [`Total Created Since ${start.toISOString().split('T')[0]}`, createdInPeriod],
      ['Pending (created in period)', pending],
      ['In Progress (created in period)', inProgress],
      ['Approved (created in period)', approved],
      ['Rejected (created in period)', rejected],
      ['Approved (approvedAt in period)', approvedAtPeriod],
    ];

    // Convert to CSV
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

    const filename = `report-${period}-${now.toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// POST /admin/toggle-status/:id
router.post('/toggle-status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let target = await Approver.findById(id);
    if (target) {
      target.status = target.status === 'Active' ? 'Inactive' : 'Active';
      await target.save();
      return res.json({ message: 'Status updated', status: target.status });
    }

    target = await Admin.findById(id);
    if (target) {
      target.status = target.status === 'Active' ? 'Inactive' : 'Active';
      await target.save();
      return res.json({ message: 'Status updated', status: target.status });
    }

    target = await User.findById(id);
    if (target) {
      // Users may use `userStatus` instead of `status`
      if (typeof target.status !== 'undefined') {
        target.status = target.status === 'Active' ? 'Inactive' : 'Active';
        await target.save();
        return res.json({ message: 'Status updated', status: target.status });
      }
      target.userStatus = target.userStatus === 'Active' ? 'Inactive' : 'Active';
      await target.save();
      return res.json({ message: 'Status updated', status: target.userStatus });
    }

    res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Error toggling status:', err);
    res.status(500).json({ error: 'Failed to toggle status' });
  }
});

// POST /admin/reset-password/:id
router.post('/reset-password/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password required' });
    }

    let target = await Approver.findById(id);
    if (target) {
      target.password = newPassword; // plain text, pre-save hook will hash
      await target.save();
      return res.json({ message: 'Password reset successfully' });
    }

    target = await Admin.findById(id);
    if (target) {
      target.password = newPassword; // plain text, pre-save hook will hash
      await target.save();
      return res.json({ message: 'Password reset successfully' });
    }

    target = await User.findById(id);
    if (target) {
      target.password = newPassword; // plain text, pre-save hook will hash
      await target.save();
      return res.json({ message: 'Password reset successfully' });
    }

    res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Debug endpoints removed — kept production routes minimal

module.exports = router;
