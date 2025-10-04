const express = require('express');
const router = express.Router();
const Permit = require('../models/Permit');

// POST form data
router.post('/submit', async (req, res) => {
  try {
    const {
      requesterName,
      requesterEmail,
      company,
      startDateTime,
      endDateTime,
      files,
      signature,
      termsAccepted
    } = req.body;

    if (!requesterName || !requesterEmail || !startDateTime || !endDateTime || !termsAccepted) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const newRequest = new Permit({
      requesterName,
      requesterEmail,
      company,
      startDateTime: new Date(startDateTime),
      endDateTime: new Date(endDateTime),
      files, // expect array of files info {fileName, fileType, fileUrl}
      signature,
      termsAccepted
    });

    await newRequest.save();

    // TODO: Send notification/email to approver here if needed

    res.status(201).json({
      message: 'Request submitted successfully',
      requestId: newRequest._id
    });

  } catch (error) {
    console.error('Error saving request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET all requests (for approver)
router.get('/requests', async (req, res) => {
  try {
    const requests = await Permit.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
