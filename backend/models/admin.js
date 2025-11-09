const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const adminSchema = new mongoose.Schema(
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
    role: { type: String, enum: ['Admin'], default: 'Admin' },
    password: { type: String, required: true }, // ✅ unified with User.js
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

  {
    timestamps: true,
    collection: 'Admin', // 👈 explicitly set collection name
  },

  { timestamps: true }
);

// Note: email field is marked unique at the schema path; avoid duplicate explicit index creation here.

// 🔹 Pre-save hook to hash password if modified or new
adminSchema.pre('save', async function (next) {
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

// 🔹 Method to compare passwords during login
adminSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword || !this.password) {
    throw new Error('Password or hash missing in comparePassword');
  }
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema, 'Admin');
