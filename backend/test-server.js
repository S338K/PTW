// Simple test server for validation testing
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

// CORS configuration
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:5500'],
    credentials: true
}));

app.use(express.json());

// Simple test endpoint
app.post('/api/register', (req, res) => {
    console.log('Registration request received:', req.body);

    // Simple validation
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({
            message: 'All fields are required'
        });
    }

    if (email === 'test@test.com') {
        return res.status(400).json({
            message: 'This email is already registered'
        });
    }

    // Success response
    res.json({
        message: 'Registration successful',
        userId: Math.random().toString(36).substr(2, 9)
    });
});

app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
});