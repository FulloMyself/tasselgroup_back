const fetch = require('node-fetch');

async function testFixedLogin() {
    const loginData = {
        email: 'admin@tasselgroup.co.za',
        password: 'admin123'
    };

    console.log('🧪 Testing FIXED login endpoint...\n');

    try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(loginData)
        });

        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Response data:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n🎉 LOGIN SUCCESSFUL!');
            console.log('Token:', data.token ? 'RECEIVED' : 'MISSING');
            console.log('User:', data.user.name, `(${data.user.role})`);
        } else {
            console.log('\n❌ LOGIN FAILED');
            console.log('Error:', data.message);
        }

    } catch (error) {
        console.error('❌ API call failed:', error.message);
    }
}

testFixedLogin();