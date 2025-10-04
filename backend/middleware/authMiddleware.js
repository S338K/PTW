// backend/middleware/authMiddleware.js

// Require login via session
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    return res.status(401).json({ message: "Unauthorized - please log in" });
}

// Generic role guard
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (req.session && allowedRoles.includes(req.session.userRole)) {
            return next();
        }
        return res.status(403).json({ error: "Access denied" });
    };
}

// Specific role guards (for convenience)
const requirePreApprover = requireRole("PreApprover");
const requireApprover = requireRole("Approver");
const requireAdmin = requireRole("Admin");

module.exports = {
    requireAuth,
    requireRole,
    requirePreApprover,
    requireApprover,
    requireAdmin
};
