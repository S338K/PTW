const express = require('express');
const router = express.Router();

// Simple lookup endpoint to centralize selectable options used by the frontend.
// In the future, this can be backed by a database or admin-configurable settings.
router.get('/lookups', async (_req, res) => {
  try {
    const terminals = ['PTC', 'RTBF', 'QROC', 'Other'];
    const facilities = {
      PTC: [
        'Arrival Hall',
        'Baggage Hall',
        'BHS Baggage Control Room',
        'Concourse Alpha',
        'Concourse Bravo',
        'Concourse Charlie',
        'Departure Hall',
        'DSF Area',
        'Terminating Alpha',
        'Terminating Bravo',
        'Concourse Alpha Basement',
        'Concourse Bravo Basement',
        'HLC Server Room',
        'HBSS Server Room',
        'MOI Break Room',
        'Custom OSR Room (Concourse Alpha)',
        'Custom OSR Room (Concourse Bravo)',
      ],
      RTBF: [
        'Baggage Hall',
        'Control Room',
        'Staff Break Room',
        'OSR Room',
        'Transfer Area',
        'Customer Service Building',
        'Employee Service Building',
        'Stagging Area',
      ],
      QROC: ['Arrival Area', 'Departure Area', 'Baggage Hall', 'BHS Baggage Control Room'],
    };

    const equipmentTypes = [
      'BHS',
      'PLB - Passenger Loading Bridge',
      'VDGS - Visual Docking Guidance System',
      'High Speed Shutter Door',
    ];

    const natureOfWork = [
      'Project',
      'Fault',
      'Preventive Maintenance',
      'Corrective Maintenance',
      'Snag Work',
    ];

    res.json({
      terminals,
      facilities,
      equipmentTypes,
      natureOfWork,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: 'Failed to fetch lookups', error: err?.message || String(err) });
  }
});

module.exports = router;
