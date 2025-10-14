const mongoose = require('mongoose');
const User = require('./models/User');

async function checkDatabase() {
    try {
        console.log('🔍 Checking database contents...');
        
        await mongoose.connect('mongodb://127.0.0.1:27017/tasselgroup');
        
        // Check users
        const users = await User.find();
        console.log(`\n👥 USERS (${users.length}):`);
        users.forEach(user => {
            console.log(`   ${user.email} - ${user.role} - Password: ${user.password ? 'HASHED' : 'MISSING'}`);
        });
        
        // Check if we can login
        const adminUser = await User.findOne({ email: 'admin@tasselgroup.co.za' });
        if (adminUser) {
            console.log('\n🔐 Admin user exists:', adminUser.email);
            console.log('   Password hash length:', adminUser.password?.length || 'MISSING');
        } else {
            console.log('\n❌ Admin user NOT FOUND');
        }
        
        await mongoose.connection.close();
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkDatabase();