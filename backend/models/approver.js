const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const approverSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => !v || /^[A-Za-z\s]+$/.test(v),
        message: 'Full name should contain letters and spaces only.',
      },
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => {
          if (!v) return false;
          const cleaned = String(v).replace(/[\s\-()]/g, '');
          return /^\+974\d{8,}$/.test(cleaned);
        },
        message: 'Phone must start with +974 and contain at least 8 digits.',
      },
    },
    company: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^[A-Za-z0-9\s]+$/.test(v),
        message: 'Company name should contain letters, numbers and spaces only.',
      },
    },
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
    // Refresh token id for JWT refresh token rotation/revocation
    refreshTokenId: { type: String, index: true },
  },
  { timestamps: true }
);

// Note: email field is marked unique at the schema path; avoid duplicate explicit index creation here.

// 🔹 Pre-save hook to hash password if modified or new
approverSchema.pre('save', async function (next) {
  // Normalize mobile to canonical form (strip spaces, hyphens, parentheses)
  if (this.mobile && typeof this.mobile === 'string') {
    this.mobile = this.mobile.replace(/[\s\-()]/g, '');
  }

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
