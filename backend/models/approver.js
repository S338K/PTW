const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const approverSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    department: { type: String, trim: true },
    designation: { type: String, trim: true },
    // Accept both hyphenated and non-hyphenated forms sent by various clients.
    // Normalize to the canonical 'PreApprover' when saving.
    role: {
      type: String,
      enum: ['Pre-Approver', 'PreApprover', 'Approver'],
      required: true,
    },
    password: { type: String, required: true }, // ✅ unified with User/Admin
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    lastLogin: { type: Date },
    prevLogin: { type: Date },

    // Single active-session enforcement (optional metadata)
    activeSessionId: { type: String, index: true },
    activeSessionCreatedAt: { type: Date },
    activeSessionUserAgent: { type: String },
    activeSessionIp: { type: String },
  },
  { timestamps: true }
);

// Note: email field is marked unique at the schema path; avoid duplicate explicit index creation here.

// 🔹 Pre-save hook to hash password if modified or new
approverSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Normalize role before validation/save
approverSchema.pre('validate', function (next) {
  if (this.role && typeof this.role === 'string') {
    const r = this.role.trim();
    if (
      r.toLowerCase() === 'pre-approver' ||
      r.toLowerCase() === 'preapprover' ||
      r.toLowerCase() === 'pre approver'
    ) {
      this.role = 'PreApprover';
    }
  }
  next();
});

// 🔹 Method to compare passwords during login
approverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Approver', approverSchema);
