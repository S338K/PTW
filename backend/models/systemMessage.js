const mongoose = require('mongoose');

const systemMessageSchema = new mongoose.Schema({
    message: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    updatedAt: { type: Date, default: Date.now }
}, { collection: 'SystemMessage' });

module.exports = mongoose.model('SystemMessage', systemMessageSchema, 'SystemMessage');
