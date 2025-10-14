// scripts/fix-preApprovedBy.js
// One-time script to set preApprovedBy for old permits where missing
// Usage: node scripts/fix-preApprovedBy.js

const mongoose = require('mongoose');
const Permit = require('../models/permit');
const User = require('../models/user');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ptw';

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all permits with preApproverName set but preApprovedBy missing
    const permits = await Permit.find({ preApproverName: { $exists: true, $ne: '' }, $or: [{ preApprovedBy: { $exists: false } }, { preApprovedBy: null }] });
    let updatedCount = 0;

    for (const permit of permits) {
        // Try to find a user with matching name (case-insensitive)
        const user = await User.findOne({ fullName: new RegExp('^' + permit.preApproverName + '$', 'i') });
        if (user) {
            permit.preApprovedBy = user._id;
            await permit.save();
            updatedCount++;
            console.log(`Updated permit ${permit._id} with preApprovedBy ${user._id}`);
        } else {
            console.log(`No user found for preApproverName: ${permit.preApproverName} (permit ${permit._id})`);
        }
    }

    console.log(`Done. Updated ${updatedCount} permits.`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('Script error:', err);
    process.exit(1);
});
