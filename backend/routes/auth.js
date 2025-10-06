const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Admin = require("../models/admin");
const Approver = require("../models/approver");
const User = require("../models/user");
require("dotenv").config();

// ----- REGISTER -----
router.post("/register", async (req, res) => {
    try {
        const {
            username, company, email, password, role,
            buildingNo, floorNo, streetNo, zone, city, country, poBox
        } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long and include one letter, number, and special character."
            });
        }

        const exists = await User.findOne({ email });
        if (exists) return res.status(409).json({ message: "Email is already in use" });

        const newUser = new User({
            username,
            email,
            password, // plain text here, pre-save hook will hash it
            company: company || "",
            role: role || "Requester",
            lastLogin: null,
            officeAddress: {
                buildingNo: buildingNo || "",
                floorNo: floorNo || "",
                streetNo: streetNo || "",
                zone: zone || "",
                city: city || "",
                country: country || "",
                poBox: poBox || ""
            }
        });

        await newUser.save();
        res.status(201).json({
            message: "Registration successful",
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                company: newUser.company,
                role: newUser.role,
                lastLogin: newUser.lastLogin,
                officeAddress: newUser.officeAddress
            }
        });
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ message: "Something went wrong", error: err.message });
    }
});

// ----- LOGIN -----
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                field: !email ? "email" : "password",
                message: "Email address and password are required"
            });
        }

        // 🔎 Try each collection in turn
        let account = await Admin.findOne({ email });
        if (!account) account = await Approver.findOne({ email });
        if (!account) account = await User.findOne({ email });

        if (!account) {
            return res.status(400).json({
                field: "email",
                message: "Please enter a valid email address."
            });
        }

        // Debug logging
        console.log("Login attempt:", {
            emailFromBody: email,
            passwordProvided: !!password,
            accountRole: account.role,
            accountHasPassword: !!account.password,
            accountPasswordSample: account.password ? account.password.slice(0, 20) + "..." : null
        });

        // ✅ Compare using schema method
        const passwordMatch = await account.comparePassword(password);
        if (!passwordMatch) {
            return res.status(400).json({
                field: "password",
                message: "Please enter a valid password."
            });
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

        req.session.save(err => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ message: "Failed to save session" });
            }

            res.json({
                message: "Login successful",
                user: {
                    id: account._id,
                    username: account.username,   // use username consistently
                    email: account.email,
                    company: account.company,
                    role: account.role,
                    // current login time (just saved)
                    lastLogin: account.lastLogin?.toISOString(),
                    // previous login time (if any)
                    prevLogin: previousLogin ? previousLogin.toISOString() : account.lastLogin?.toISOString()
                }
            });
        });


    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            message: "Something went wrong, try again",
            error: err.message
        });
    }
});

// ----- PROFILE -----
router.get("/profile", async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ message: "Unauthorized - session expired" });

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
            user = await User.findById(req.session.userId).select('-password -resetPasswordToken -resetPasswordExpires');
        }

        if (!user) {
            // if user not found in expected collection, try a broad search (safety)
            const Admin = require('../models/admin');
            const Approver = require('../models/approver');
            user = await User.findById(req.session.userId).select('-password -resetPasswordToken -resetPasswordExpires')
                || await Approver.findById(req.session.userId).select('-password')
                || await Admin.findById(req.session.userId).select('-password');
        }

        if (!user) {
            req.session.destroy();
            return res.status(401).json({ message: "Unauthorized - user not found" });
        }

        res.json({
            user,
            session: { id: req.session.userId, role: req.session.userRole }
        });
    } catch (err) {
        console.error("Profile fetch error:", err);
        res.status(500).json({ message: "Unable to fetch profile", error: err.message });
    }
});

// ----- LOGOUT -----
router.post("/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ message: "Logout failed" });
        }
        res.clearCookie("sessionId", {
            httpOnly: true,
            sameSite: "none",
            secure: process.env.NODE_ENV === "production"
        });
        res.json({ message: "Logged out successfully" });
    });
});

// ----- FORGOT PASSWORD -----
router.post("/forgot-password", async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const genericOk = { message: "If the email exists, a reset link will be sent" };
        const user = await User.findOne({ email });
        if (!user) return res.status(200).json(genericOk);

        const rawToken = crypto.randomBytes(20).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 1000 * 60 * 15;
        await user.save();

        const frontendBase = process.env.FRONTEND_BASE_URL || "https://s338k.github.io";
        const resetLink = `${frontendBase}/PTW/reset-password.html?token=${rawToken}`;

        if (process.env.NODE_ENV !== "production") {
            console.log("[DEV MODE] Reset link:", resetLink);
            return res.status(200).json({ message: "Password reset link (dev mode)", resetLink, token: rawToken });
        }
        return res.status(200).json(genericOk);
    } catch (err) {
        next(err);
    }
});

// ----- RESET PASSWORD -----
router.post("/reset-password", async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword)
            return res.status(400).json({ message: "Token and new password are required" });

        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!strongPasswordRegex.test(newPassword)) {
            return res.status(400).json({ message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character." });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user) return res.status(400).json({ message: "Invalid or expired token" });

        user.password = newPassword; // plain text, pre-save hook will hash
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.error("[Reset Password] Error:", err);
        res.status(500).json({ message: "Error resetting password", error: err.message });
    }
});

module.exports = router;
