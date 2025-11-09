// backend/middleware/authMiddleware.js

// Require login via session
function requireAuth(req, res, next) {
  // Accept a Bearer access token (JWT) in Authorization header for per-tab
  // auth. If not present, fall back to the existing session cookie approach.
  try {
    const authHeader = req.headers && req.headers.authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const jwt = require('jsonwebtoken');
        const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-jwt-secret';
        try {
          const payload = jwt.verify(token, secret);
          // emulate a session-like shape so existing handlers (which read
          // req.session.userId / userRole) continue to work for token-auth
          req.session = req.session || {};
          req.session.userId = payload.sub || payload.id || null;
          req.session.userRole = payload.role || payload.r || payload.role;
          // mark it's token-auth so other middleware can behave accordingly
          req.tokenAuth = true;
          return next();
        } catch (e) {
          // invalid token - fall through to session check
        }
      }
    }
  } catch (e) {
    // be permissive on middleware errors and fall back
  }

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
    // If token-based auth was used, skip active-session enforcement here.
    // Token-based (per-tab) sessions are intentionally independent.
    if (req.tokenAuth) return next();
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
