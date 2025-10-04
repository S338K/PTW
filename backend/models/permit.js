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
  permitTitle: String,
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
  startDateTime: { type: Date },   // ✅ use Date instead of String
  endDateTime: { type: Date },     // ✅ use Date instead of String
  signName: String,
  signDate: String,
  signTime: String,
  designation: String,
  files: [fileSchema], // 🔹 embedded file documents
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // link to logged-in user

  // 🔹 Pre‑Approver tracking
  preApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  preApprovedAt: Date,
  preApproverComments: String,

  status: {
    type: String,
    enum: ["Pending", "In Progress", "Approved", "Rejected"],
    default: "Pending"
  }, // workflow statuses

  permitNumber: { type: String, unique: true, sparse: true }, // only set when approved
  role: String,

  // ✅ New field for approval timestamp
  approvedAt: { type: Date }
}, {
  timestamps: true,
  collection: 'PermitData'   // 👈 force collection name
});

// 🔹 Export model
module.exports = mongoose.model('PermitData', permitSchema);
