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
    if (process.env.NODE_ENV !== 'production')
      console.debug('[DEBUG] /admin/register-user req.body=', req.body);
    const { fullName, email, mobile, company, department, designation, password, role } = req.body;
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[DEBUG] /admin/register-user body role=', role);
    }

    // Basic validation
    if (!fullName || !email || !mobile || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Server-side validation to mirror client rules
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const alphaRe = /^[A-Za-z\s]+$/;
    const passwordRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    const phoneRe = /^\+974\d{8,}$/;

    if (!emailRe.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (!alphaRe.test(fullName))
      return res.status(400).json({ error: 'Full name should contain letters only' });
    // normalize mobile (strip common separators) so values like '+974 1234-5678' are accepted
    const cleanMobile = String(mobile || '')
      .trim()
      .replace(/[\s\-()]/g, '');
    if (!phoneRe.test(cleanMobile))
      return res
        .status(400)
        .json({ error: 'Phone must start with +974 and contain at least 8 digits' });
    if (!passwordRe.test(password))
      return res.status(400).json({
        error:
          'Password must be at least 8 characters long and include upper/lower case letters, a number and a special character',
      });

    // Require confirmPassword and ensure it matches the password
    if (
      typeof req.body.confirmPassword === 'undefined' ||
      String(req.body.confirmPassword || '').trim() === ''
    ) {
      return res.status(400).json({ error: 'confirmPassword is required' });
    }
    const confirm = String(req.body.confirmPassword || '');
    if (confirm !== String(password || '')) {
      return res.status(400).json({ error: 'Password and confirm password do not match' });
    }

    // Defensive normalization: accept hyphenated or spaced variants and normalize to canonical values
    let normalizedRole = role;
    if (typeof normalizedRole === 'string') {
      const r = normalizedRole.trim().toLowerCase();
      if (process.env.NODE_ENV !== 'production')
        console.debug('[DEBUG] normalized role input lower=', r);
      if (r === 'pre-approver' || r === 'preapprover' || r === 'pre approver')
        normalizedRole = 'PreApprover';
      else if (r === 'approver') normalizedRole = 'Approver';
      else if (r === 'admin') normalizedRole = 'Admin';
      else if (r === 'requester' || r === 'user') normalizedRole = 'Requester';
    }
    if (process.env.NODE_ENV !== 'production')
      console.debug('[DEBUG] normalizedRole after mapping=', normalizedRole);

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
      if (
        String(normalizedRole).toLowerCase() === 'requester' ||
        String(role).toLowerCase() === 'requester'
      ) {
        // ensure email isn't used by any account type
        const existsAny =
          (await Admin.findOne({ email })) ||
          (await Approver.findOne({ email })) ||
          (await User.findOne({ email }));
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
      // Return full ISO datetimes so the client can format time correctly
      registered: u.createdAt ? u.createdAt.toISOString() : '—',
      lastLogin: u.lastLogin ? u.lastLogin.toISOString() : '—',
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
    const pending = await Permit.countDocuments({
      status: { $in: ['Pending'] },
      createdAt: { $gte: start },
    });
    const inProgress = await Permit.countDocuments({
      status: 'In Progress',
      createdAt: { $gte: start },
    });
    const approved = await Permit.countDocuments({
      status: 'Approved',
      createdAt: { $gte: start },
    });
    const rejected = await Permit.countDocuments({
      status: 'Rejected',
      createdAt: { $gte: start },
    });

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
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

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

// PATCH /admin/users/:id - update user fields (Admin, Approver, or User)
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['fullName', 'email', 'mobile', 'company', 'department', 'designation', 'role'];
    const updates = {};
    for (const key of allowed) {
      if (typeof req.body[key] !== 'undefined') updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ error: 'No updatable fields provided' });

    // Try Approver
    let target = await Approver.findById(id);
    if (target) {
      Object.assign(target, updates);
      // Normalize role if provided
      if (updates.role) {
        const r = String(updates.role).trim().toLowerCase();
        if (r === 'pre-approver' || r === 'preapprover') target.role = 'PreApprover';
        else if (r === 'approver') target.role = 'Approver';
        else if (r === 'admin') target.role = 'Admin';
        else if (r === 'requester' || r === 'user') target.role = 'Requester';
      }
      await target.save();
      return res.json({ message: 'User updated', user: target });
    }

    // Try Admin
    target = await Admin.findById(id);
    if (target) {
      Object.assign(target, updates);
      if (updates.role) {
        const r = String(updates.role).trim().toLowerCase();
        if (r === 'admin') target.role = 'Admin';
        else if (r === 'approver' || r === 'pre-approver' || r === 'preapprover')
          target.role = 'Approver';
        else if (r === 'requester') target.role = 'Requester';
      }
      await target.save();
      return res.json({ message: 'User updated', user: target });
    }

    // Try User (Requester)
    target = await User.findById(id);
    if (target) {
      // Note: some user models use `username` instead of fullName
      if (typeof updates.fullName !== 'undefined') target.fullName = updates.fullName;
      if (typeof updates.email !== 'undefined') target.email = updates.email;
      if (typeof updates.mobile !== 'undefined') target.mobile = updates.mobile;
      if (typeof updates.company !== 'undefined') target.company = updates.company;
      if (typeof updates.department !== 'undefined') target.department = updates.department;
      if (typeof updates.designation !== 'undefined') target.designation = updates.designation;
      if (updates.role) {
        const r = String(updates.role).trim().toLowerCase();
        if (r === 'requester' || r === 'user') target.role = 'Requester';
        else if (r === 'approver' || r === 'pre-approver') target.role = 'Approver';
        else if (r === 'admin') target.role = 'Admin';
      }
      await target.save();
      return res.json({ message: 'User updated', user: target });
    }

    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

// DELETE /admin/users/:id - permanently delete a user (Admin/Approver/User)
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Try Approver
    let target = await Approver.findById(id);
    if (target) {
      await Approver.deleteOne({ _id: id });
      return res.json({ message: 'User deleted' });
    }
    // Try Admin
    target = await Admin.findById(id);
    if (target) {
      await Admin.deleteOne({ _id: id });
      return res.json({ message: 'User deleted' });
    }
    // Try User
    target = await User.findById(id);
    if (target) {
      await User.deleteOne({ _id: id });
      return res.json({ message: 'User deleted' });
    }
    return res.status(404).json({ error: 'User not found' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

// Debug endpoints removed — kept production routes minimal

module.exports = router;
