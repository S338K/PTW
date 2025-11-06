// backend/middleware/authMiddleware.js

// Require login via session
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ message: 'Unauthorized - please log in' });
}

// Generic role guard
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (req.session && allowedRoles.includes(req.session.userRole)) {
      return next();
    }
    return res.status(403).json({ error: 'Access denied' });
  };
}

// Specific role guards (for convenience)
const requirePreApprover = requireRole('PreApprover');
const requireApprover = requireRole('Approver');
const requireAdmin = requireRole('Admin');

module.exports = {
  requireAuth,
  requireRole,
  requirePreApprover,
  requireApprover,
  requireAdmin,
};

// Enforce that the current session is the user's active session
// If a different device/browser took over, revoke this session's access.
async function enforceActiveSession(req, res, next) {
  try {
    if (!req.session || !req.session.userId) return next(); // nothing to enforce if not logged in

    const role = req.session.userRole;
    const id = req.session.userId;
    let AccountModel;
    if (role === 'Admin') {
      AccountModel = require('../models/admin');
    } else if (role === 'Approver' || role === 'PreApprover') {
      AccountModel = require('../models/approver');
    } else {
      AccountModel = require('../models/user');
    }

    const acc = await AccountModel.findById(id).select('activeSessionId');
    if (!acc) {
      // user no longer exists; end session
      try { req.session.destroy(() => { }); } catch (_) { /* ignore */ }
      return res.status(401).json({ code: 'NO_ACCOUNT', message: 'Your account is no longer available.' });
    }

    const activeId = acc.activeSessionId;
    if (activeId && activeId !== req.sessionID) {
      try { req.session.destroy(() => { }); } catch (_) { /* ignore */ }
      return res.status(440).json({ code: 'SESSION_REVOKED', message: 'Your session ended because it was used on another device. Please sign in again.' });
    }

    return next();
  } catch (e) {
    // On error, be permissive to avoid blocking users due to transient DB issues
    return next();
  }
}

module.exports.enforceActiveSession = enforceActiveSession;
