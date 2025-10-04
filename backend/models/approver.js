const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const approverSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    role: { type: String, enum: ["PreApprover", "Approver"], required: true },
    password: { type: String, required: true },   // ✅ unified with User/Admin
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    lastLogin: { type: Date }
  },
  { timestamps: true }
);

// Unique index on email
approverSchema.index({ email: 1 }, { unique: true });

// 🔹 Pre-save hook to hash password if modified or new
approverSchema.pre("save", async function (next) {
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
approverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("Approver", approverSchema);
