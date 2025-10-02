// backend/middleware/authMiddleware.js

// Require login via session
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    return res.status(401).json({ message: "Unauthorized - please log in" });
}

// Role guards (using session.userRole)
function requirePreApprover(req, res, next) {
    if (req.session?.userRole === "PreApprover") return next();
    return res.status(403).json({ error: "Access denied" });
}

function requireApprover(req, res, next) {
    if (req.session?.userRole === "Approver") return next();
    return res.status(403).json({ error: "Access denied" });
}

function requireAdmin(req, res, next) {
    if (req.session?.userRole === "Admin") return next();
    return res.status(403).json({ error: "Access denied" });
}

module.exports = {
    requireAuth,
    requirePreApprover,
    requireApprover,
    requireAdmin
};
