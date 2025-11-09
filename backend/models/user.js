const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => !v || /^[A-Za-z\s]+$/.test(v),
        message: 'Full name should contain letters and spaces only.',
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
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    lastLogin: { type: Date },
    prevLogin: { type: Date },
    role: {
      type: String,
      enum: ['Requester', 'PreApprover', 'FinalApprover', 'Admin'],
      default: 'Requester',
    },

    userStatus: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },

    resetPasswordToken: {
      type: String,
    },

    resetPasswordExpires: {
      type: Date,
      index: true,
    },

    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          const cleaned = String(v).replace(/[\s\-()]/g, '');
          return /^\+974\d{8,}$/.test(cleaned);
        },
        message: 'Phone must start with +974 and contain at least 8 digits.',
      },
    },

    passwordUpdatedAt: {
      type: Date,
    },

    profileUpdatedAt: {
      type: Date,
    },

    // Simple audit logs for profile and password changes
    profileUpdateLogs: [
      {
        remark: { type: String, trim: true },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    passwordUpdateLogs: [
      {
        remark: { type: String, trim: true },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    // Single active-session enforcement
    activeSessionId: { type: String, index: true },
    activeSessionCreatedAt: { type: Date },
    activeSessionUserAgent: { type: String },
    activeSessionIp: { type: String },
    // Refresh token id (jti) for rotating refresh tokens when using JWT-based
    // per-tab authentication. Stored as a short identifier so refresh tokens
    // can be revoked when a user logs out or an admin invalidates sessions.
    refreshTokenId: { type: String, index: true },

    // 🔹 New Office Address subdocument
    officeAddress: {
      buildingNo: {
        type: String,
        trim: true,
        validate: {
          validator: (v) => !v || /^\d{1,2}$/.test(v),
          message: 'Building No. should be 1–2 digits.',
        },
      },
      floorNo: {
        type: String,
        trim: true,
        validate: {
          validator: (v) => !v || /^\d{1,2}$/.test(v),
          message: 'Floor No. should be 1–2 digits.',
        },
      },
      streetNo: {
        type: String,
        trim: true,
        validate: {
          validator: (v) => !v || /^\d{1,3}$/.test(v),
          message: 'Street No. should be 1–3 digits.',
        },
      },
      zone: {
        type: String,
        trim: true,
        validate: {
          validator: (v) => !v || /^\d{1,2}$/.test(v),
          message: 'Zone should be 1–2 digits.',
        },
      },
      city: {
        type: String,
        trim: true,
        validate: {
          validator: (v) => !v || /^[A-Za-z\s]+$/.test(v),
          message: 'City should contain letters only.',
        },
      },
      country: {
        type: String,
        trim: true,
        validate: {
          validator: (v) => !v || /^[A-Za-z\s]+$/.test(v),
          message: 'Country should contain letters only.',
        },
      },
      poBox: {
        type: String,
        trim: true,
        validate: {
          validator: (v) => !v || /^\d{1,6}$/.test(v),
          message: 'P.O. Box should be 1–6 digits.',
        },
      },
    },
  },
  { timestamps: true }
);

// 🔹 Pre-save hook to hash password if modified or new
userSchema.pre('save', async function (next) {
  // Normalize phone to canonical form (strip spaces, hyphens, parentheses)
  if (this.phone && typeof this.phone === 'string') {
    this.phone = this.phone.replace(/[\s\-()]/g, '');
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
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
