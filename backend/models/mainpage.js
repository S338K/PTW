const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileName: String,
  fileType: String, // e.g. 'pdf', 'jpeg'
  fileUrl: String // optional, if storing uploaded file URL/path
});

const mainPageSchema = new mongoose.Schema({
  requesterName: { type: String, required: true },
  requesterEmail: { type: String, required: true },
  company: String,
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  files: [fileSchema],
  signature: {
    name: String,
    date: String, // or Date, depending on how you want to store
    time: String,
    designation: String
  },
  termsAccepted: { type: Boolean, required: true },
  status: { type: String, default: 'Pending' }, // e.g. Pending, Approved, Rejected
  approverComments: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MainPage', mainPageSchema);
