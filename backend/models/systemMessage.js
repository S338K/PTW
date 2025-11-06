const mongoose = require('mongoose');

const translationSchema = new mongoose.Schema({
    lang: { type: String, required: true },
    title: { type: String, default: 'Announcement' },
    message: { type: String, required: true }
}, { _id: false });

const systemMessageSchema = new mongoose.Schema({
    // Primary (fallback) title/message for older clients
    title: { type: String, default: 'Announcement' },
    message: { type: String },
    translations: { type: [translationSchema], default: [] },
    icon: { type: String, default: 'fa-bullhorn' },
    isActive: { type: Boolean, default: true },
    // Optional scheduling window
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'SystemMessage' });

// Update the updatedAt field before saving
systemMessageSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('SystemMessage', systemMessageSchema, 'SystemMessage');
