const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const adminSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        mobile: { type: String, required: true, trim: true },
        company: { type: String, trim: true },
        department: { type: String, trim: true },
        designation: { type: String, trim: true },
        role: { type: String, enum: ["Admin"], default: "Admin" },
        password: { type: String, required: true },   // ✅ unified with User.js
        status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
        lastLogin: { type: Date }
    },

    {
        timestamps: true,
        collection: "Admin"   // 👈 explicitly set collection name
    },

    { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);


// Unique index on email
adminSchema.index({ email: 1 }, { unique: true });

// 🔹 Pre-save hook to hash password if modified or new
adminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// 🔹 Method to compare passwords during login
adminSchema.methods.comparePassword = async function (candidatePassword) {
    if (!candidatePassword || !this.password) {
        throw new Error("Password or hash missing in comparePassword");
    }
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Admin", adminSchema, "Admin"); 