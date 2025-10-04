const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        mobile: { type: String, required: true, trim: true },
        company: { type: String, trim: true },
        department: { type: String, trim: true },
        designation: { type: String, trim: true },
        role: { type: String, enum: ["Admin"], required: true, default: "Admin" },
        passwordHash: { type: String, required: true },
        status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
        lastLogin: { type: Date }
    },
    { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

adminSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("admin", adminSchema);
