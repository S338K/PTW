const mongoose = require('mongoose');

// 🔹 Subdocument schema for files stored in MongoDB
const fileSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true } // binary file data
});

// 🔹 Main permit schema
const permitSchema = new mongoose.Schema({
  fullName: String,
  lastName: String,
  contactDetails: String,
  altContactDetails: String,
  corpEmailId: String,
  terminal: String,
  facility: String,
  specifyTerminal: String,
  specifyFacility: String,
  workDescription: String,
  impact: String,
  equipmentTypeInput: String,
  impactDetailsInput: String,
  ePermit: String,
  ePermitReason: String,
  fmmWorkorder: String,
  noFmmWorkorder: String,
  hseRisk: String,
  noHseRiskAssessmentReason: String,
  opRisk: String,
  noOpsRiskAssessmentReason: String,
  startDateTime: String,
  endDateTime: String,
  signName: String,
  signDate: String,
  signTime: String,
  designation: String,
  files: [fileSchema], // 🔹 embedded file documents
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // link to logged-in user
  role: String
}, {
  timestamps: true,
  collection: 'PermitData'   // 👈 force collection name
});

// 🔹 Export model
module.exports = mongoose.model('PermitData', permitSchema);
