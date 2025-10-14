const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function debugLogin() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/tasselgroup');
        
        console.log('🔐 DEBUGGING LOGIN PROCESS...\n');
        
        const testEmail = 'admin@tasselgroup.co.za';
        const testPassword = 'admin123';
        
        // 1. Find user
        console.log('1. 🔍 Finding user...');
        const user = await User.findOne({ email: testEmail });
        console.log('   User found:', !!user);
        console.log('   User ID:', user?._id);
        console.log('   User email:', user?.email);
        console.log('   User role:', user?.role);
        
        if (!user) {
            console.log('❌ USER NOT FOUND');
            return;
        }
        
        // 2. Check password
        console.log('\n2. 🔑 Checking password...');
        console.log('   Input password:', testPassword);
        console.log('   Stored hash:', user.password.substring(0, 20) + '...');
        console.log('   Hash length:', user.password.length);
        
        const isMatch = await bcrypt.compare(testPassword, user.password);
        console.log('   Password matches:', isMatch);
        
        if (!isMatch) {
            console.log('\n❌ PASSWORD MISMATCH');
            console.log('   Let me test creating a new hash...');
            
            const newHash = await bcrypt.hash(testPassword, 10);
            console.log('   New hash for same password:', newHash.substring(0, 20) + '...');
            console.log('   Do they match?', user.password === newHash);
            console.log('   This is expected to be false - bcrypt creates different hashes each time');
            
            // Test with the actual compare function
            const shouldMatch = await bcrypt.compare(testPassword, user.password);
            console.log('   bcrypt.compare should return:', shouldMatch);
        } else {
            console.log('\n✅ PASSWORD MATCHES - USER SHOULD BE ABLE TO LOGIN');
        }
        
        // 3. Test JWT token creation
        console.log('\n3. 🎫 Testing JWT token...');
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );
        console.log('   Token created:', !!token);
        console.log('   Token length:', token.length);
        console.log('   Token sample:', token.substring(0, 20) + '...');
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        console.log('   Token verified:', !!decoded);
        console.log('   Decoded user ID:', decoded.userId);
        
        await mongoose.connection.close();
        
        console.log('\n🎉 LOGIN PROCESS SHOULD WORK!');
        console.log('💡 If login is still failing, check your auth route implementation');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugLogin();