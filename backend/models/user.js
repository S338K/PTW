const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({

    username: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    lastLogin: { type: Date },

    role: {
        type: String,
        enum: ['Requester', 'PreApprover', 'FinalApprover', 'Admin'],
        default: 'Requester'
    },

    userStatus: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active"
    },

    resetPasswordToken: {
        type: String
    },

    resetPasswordExpires: {
        type: Date,
        index: true
    },

    // 🔹 New Office Address subdocument
    officeAddress: {
        buildingNo: { type: String, trim: true },
        floorNo: { type: String, trim: true },
        streetNo: { type: String, trim: true },
        zone: { type: String, trim: true },
        city: { type: String, trim: true },
        country: { type: String, trim: true },
        poBox: { type: String, trim: true }
    }

}, { timestamps: true });

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

module.exports = mongoose.model('user', userSchema);
