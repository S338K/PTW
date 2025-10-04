const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Approver = require("../models/Approver");
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

        const user = new User({
            username,
            email,
            password,
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

        await user.save();
        res.status(201).json({
            message: "Registration successful",
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
        let user = await Admin.findOne({ email });
        if (!user) user = await Approver.findOne({ email });
        if (!user) user = await PreApprover.findOne({ email });

        if (!user) {
            return res.status(400).json({
                field: "email",
                message: "Please enter a valid email address."
            });
        }

        // ✅ Compare against passwordHash
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
            return res.status(400).json({
                field: "password",
                message: "Please enter a valid password."
            });
        }

        // 🔑 Set session values
        req.session.userId = user._id;
        req.session.userRole = user.role;
        req.session.cookie.maxAge = 2 * 60 * 60 * 1000; // 2 hours

        const previousLogin = user.lastLogin;
        user.lastLogin = new Date();
        await user.save();

        req.session.save(err => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ message: "Failed to save session" });
            }
            res.json({
                message: "Login successful",
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    company: user.company,
                    role: user.role,
                    lastLogin: previousLogin ? previousLogin.toISOString() : new Date().toISOString()
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

module.exports = router;


// ----- PROFILE -----
router.get("/profile", async (req, res) => {
    try {
        if (!req.session.userId) return res.status(401).json({ message: "Unauthorized - session expired" });

        const user = await User.findById(req.session.userId).select("-password -resetPasswordToken -resetPasswordExpires");
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
        const resetLink = `${frontendBase} /PTW/reset - password.html ? token = ${rawToken} `;

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

        user.password = await bcrypt.hash(newPassword, 10);
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
