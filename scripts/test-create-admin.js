// Quick test script to create a test admin via Mongoose to verify password hashing & DB storage
// Usage: node scripts/test-create-admin.js

const mongoose = require('mongoose');
const Admin = require('../backend/models/admin');
require('dotenv').config({ path: './backend/.env' });

async function run() {
    try {
        const uri = process.env.MONGO_URI;
        if (!uri) throw new Error('MONGO_URI not set in backend/.env');
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to DB');

        const testEmail = 'test-admin-for-automation@example.com';
        // remove existing test doc
        await Admin.deleteMany({ email: testEmail });

        const admin = new Admin({
            fullName: 'Test Admin Auto',
            email: testEmail,
            mobile: '1234567890',
            company: 'PTW Test',
            password: 'PlainPassword123!',
            role: 'Admin'
        });

        const saved = await admin.save();
        console.log('Saved admin id:', saved._id);
        console.log('Stored password hash sample:', saved.password.slice(0, 20) + '...');

        // cleanup
        await Admin.deleteOne({ _id: saved._id });
        console.log('Cleaned up test admin');

        await mongoose.disconnect();
        console.log('Disconnected');
    } catch (err) {
        console.error('Error in test:', err);
        process.exit(1);
    }
}

run();
