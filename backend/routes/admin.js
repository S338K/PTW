const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Approver = require("../models/Approver");
const Admin = require("../models/Admin");


const router = express.Router();

// Middleware to ensure only Admins can access these routes
function requireAdmin(req, res, next) {
    if (req.session && req.session.role === "Admin") {
        return next();
    }
    return res.status(403).json({ error: "Unauthorized" });
}

// Apply to all routes in this file
router.use(requireAdmin);

// POST /admin/register-User
router.post("/register-User", async (req, res) => {
    try {
        const {
            fullName,
            email,
            mobile,
            company,
            department,
            designation,
            password,
            userType
        } = req.body;

        // Basic validation
        if (!fullName || !email || !mobile || !password || !userType) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        if (userType === "Admin") {
            // Save to Admin collection
            const admin = new admin({
                fullName,
                email,
                mobile,
                company,
                department,
                designation,
                passwordHash,
                role: "Admin"
            });
            await admin.save();
        } else if (userType === "Pre-Approver" || userType === "Approver") {
            // Save to Approver collection
            const approver = new approver({
                fullName,
                email,
                mobile,
                company,
                department,
                designation,
                passwordHash,
                role: userType
            });
            await approver.save();
        } else {
            return res.status(400).json({ error: "Invalid User type" });
        }

        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        console.error(err);
        if (err.code === 11000) {
            // Duplicate email
            return res.status(409).json({ error: "Email already exists" });
        }
        res.status(500).json({ error: "Server error" });
    }
});

// GET /admin/users
// GET /admin/users
router.get("/users", async (req, res) => {
    try {
        // Fetch both collections
        const approvers = await Approver.find().lean();
        const admins = await Admin.find().lean();

        // Normalize into a unified shape for the frontend
        const normalize = (u) => ({
            id: u._id,
            username: u.fullName,
            role: u.role,
            status: u.status || "Active",
            registered: u.createdAt ? u.createdAt.toISOString().split("T")[0] : "—",
            lastLogin: u.lastLogin ? u.lastLogin.toISOString().split("T")[0] : "—"
        });

        const users = [
            ...approvers.map(normalize),
            ...admins.map(normalize)
        ];

        res.json(users);
    } catch (err) {
        console.error("Error loading users:", err);
        res.status(500).json({ error: "Failed to load users" });
    }
});


// GET /admin/stats
// GET /admin/stats
router.get("/stats", async (req, res) => {
    try {
        // Admin counts
        const totalAdmins = await Admin.countDocuments();
        const activeAdmins = await Admin.countDocuments({ status: "Active" });
        const inactiveAdmins = await Admin.countDocuments({ status: "Inactive" });

        // Approver counts (includes Pre-Approver + Approver)
        const totalApprovers = await Approver.countDocuments();
        const activeApprovers = await Approver.countDocuments({ status: "Active" });
        const inactiveApprovers = await Approver.countDocuments({ status: "Inactive" });

        // Role breakdown inside Approver collection
        const preApprovers = await Approver.countDocuments({ role: "Pre-Approver" });
        const approvers = await Approver.countDocuments({ role: "Approver" });

        // Build response
        res.json({
            totalUsers: totalAdmins + totalApprovers,
            activeUsers: activeAdmins + activeApprovers,
            inactiveUsers: inactiveAdmins + inactiveApprovers,
            admins: totalAdmins,
            preApprovers,
            approvers
            // permits stats can be added later once we confirm permits schema
        });
    } catch (err) {
        console.error("Error loading stats:", err);
        res.status(500).json({ error: "Failed to load stats" });
    }
});

// POST /admin/toggle-status/:id
router.post("/toggle-status/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Try Approver first
        let User = await Approver.findById(id);
        if (User) {
            User.status = User.status === "Active" ? "Inactive" : "Active";
            await User.save();
            return res.json({ message: "Status updated", status: User.status });
        }

        // Try Admin
        User = await Admin.findById(id);
        if (User) {
            User.status = User.status === "Active" ? "Inactive" : "Active";
            await User.save();
            return res.json({ message: "Status updated", status: User.status });
        }

        res.status(404).json({ error: "User not found" });
    } catch (err) {
        console.error("Error toggling status:", err);
        res.status(500).json({ error: "Failed to toggle status" });
    }
});

// POST /admin/reset-password/:id
router.post("/reset-password/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: "New password required" });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Try Approver first
        let User = await Approver.findById(id);
        if (User) {
            User.passwordHash = passwordHash;
            await User.save();
            return res.json({ message: "Password reset successfully" });
        }

        // Try Admin
        User = await Admin.findById(id);
        if (User) {
            User.passwordHash = passwordHash;
            await User.save();
            return res.json({ message: "Password reset successfully" });
        }

        res.status(404).json({ error: "User not found" });
    } catch (err) {
        console.error("Error resetting password:", err);
        res.status(500).json({ error: "Failed to reset password" });
    }
});



module.exports = router;
