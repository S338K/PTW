const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/user"); // adjust path if needed
const logger = require('./logger');

async function seedAdmin() {
    await mongoose.connect("mongodb+srv://doha:Doha2o2o@cluster0.ixohqzy.mongodb.net/PTW?retryWrites=true&w=majority&appName=Cluster0");

    const admin = new User({
        username: "test.admin",
        fullName: "Test Admin",
        email: "admin@test.com",
        mobileNumber: "87654321",
        company: "Test Company",
        department: "Ops",
        designation: "Operator",
        password: "Admin@1234",   // 👈 plain text here, hook will hash it
        role: "Admin",
        status: "Active",
        registered: new Date()
    });


    await admin.save();
    logger.info('✅ Admin user created');
    mongoose.disconnect();
}

seedAdmin().catch(err => logger.error(err));
