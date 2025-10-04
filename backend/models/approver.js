const mongoose = require("mongoose");

const preapproverSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    role: { type: String, enum: ["Pre-Approver", "Approver"], required: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    lastLogin: { type: Date }
}, { timestamps: true });

// model name here is "preapprover"
module.exports = mongoose.model("approver", preapproverSchema);
