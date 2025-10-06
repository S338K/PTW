require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Permit = require('./models/permit');

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: 'PTW'
        });

        console.log('Connected to MongoDB');

        // Check users
        const users = await User.find({}, 'username email role');
        console.log('\n=== USERS ===');
        users.forEach(user => {
            console.log(`ID: ${user._id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
        });

        // Check permits
        const permits = await Permit.find({}).populate('requester', 'username email');
        console.log('\n=== PERMITS ===');
        if (permits.length === 0) {
            console.log('No permits found in database');
        } else {
            permits.forEach(permit => {
                console.log(`ID: ${permit._id}, Title: ${permit.permitTitle}, Status: ${permit.status}, Requester: ${permit.requester?.username || 'Unknown'}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

checkData();