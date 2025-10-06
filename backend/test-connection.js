require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./logger');

async function testConnection() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            dbName: 'PTW'
        });
        console.log('✅ MongoDB Connection successful!');
        console.log('Connected to database:', mongoose.connection.name);
        console.log('Connection state:', mongoose.connection.readyState);
    } catch (error) {
        console.error('❌ MongoDB Connection error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

testConnection();