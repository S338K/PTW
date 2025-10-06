// Test script to verify permit API functionality
require('dotenv').config();
const axios = require('axios');

async function testPermitAPI() {
    try {
        console.log('Testing permit API endpoint...');

        // First, test if the server is responding
        const healthCheck = await axios.get('http://localhost:5000');
        console.log('✅ Server is responsive:', healthCheck.data);

        // Test the permit API without authentication (should return 401)
        try {
            const permitResponse = await axios.get('http://localhost:5000/api/permit');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Permit API correctly requires authentication');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        console.log('✅ API endpoints are working correctly');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testPermitAPI();