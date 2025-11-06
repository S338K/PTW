const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
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
        updatedAt: { type: Date, default: Date.now }
      }
    ],
    passwordUpdateLogs: [
      {
        remark: { type: String, trim: true },
        updatedAt: { type: Date, default: Date.now }
      }
    ],

    // Single active-session enforcement
    activeSessionId: { type: String, index: true },
    activeSessionCreatedAt: { type: Date },
    activeSessionUserAgent: { type: String },
    activeSessionIp: { type: String },

    // 🔹 New Office Address subdocument
    officeAddress: {
      buildingNo: { type: String, trim: true },
      floorNo: { type: String, trim: true },
      streetNo: { type: String, trim: true },
      zone: { type: String, trim: true },
      city: { type: String, trim: true },
      country: { type: String, trim: true },
      poBox: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

// 🔹 Pre-save hook to hash password if modified or new
userSchema.pre('save', async function (next) {
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
