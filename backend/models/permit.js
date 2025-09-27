const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  originalName: String,
  path: String,
  size: Number
});

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
  files: [fileSchema]
}, { timestamps: true });

// Explicitly name the collection "permitdatas"
module.exports = mongoose.model('Permitdata', permitSchema, 'permitdatas');
