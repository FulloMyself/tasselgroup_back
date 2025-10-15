// checkAndSeed.js - Script to check MongoDB and seed database
const { exec } = require('child_process');
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/tasselgroup';

function checkMongoDBConnection() {
    return new Promise((resolve, reject) => {
        console.log('🔍 Checking MongoDB connection...');
        
        mongoose.connect(MONGODB_URI, { 
            serverSelectionTimeoutMS: 3000,
            connectTimeoutMS: 3000 
        })
        .then(() => {
            console.log('✅ MongoDB is running and accessible');
            mongoose.connection.close();
            resolve(true);
        })
        .catch(error => {
            console.log('❌ MongoDB is not running or not accessible');
            console.log('💡 Error:', error.message);
            resolve(false);
        });
    });
}

function startMongoDB() {
    return new Promise((resolve, reject) => {
        console.log('🚀 Attempting to start MongoDB...');
        
        // Try different methods to start MongoDB on Windows
        const commands = [
            'net start MongoDB',
            'sc start MongoDB',
            'mongod --dbpath="C:\\data\\db"'
        ];

        function tryCommand(index) {
            if (index >= commands.length) {
                console.log('❌ Could not start MongoDB automatically');
                console.log('\n💡 Please start MongoDB manually:');
                console.log('   1. Open Services (services.msc) and start "MongoDB Server"');
                console.log('   2. Or run: net start MongoDB');
                console.log('   3. Or run: mongod --dbpath="C:\\data\\db"');
                resolve(false);
                return;
            }

            console.log(`   Trying: ${commands[index]}`);
            exec(commands[index], (error, stdout, stderr) => {
                if (error) {
                    console.log(`   Failed: ${error.message}`);
                    tryCommand(index + 1);
                } else {
                    console.log('✅ MongoDB started successfully');
                    // Wait a moment for MongoDB to fully start
                    setTimeout(() => resolve(true), 2000);
                }
            });
        }

        tryCommand(0);
    });
}

async function main() {
    console.log('🔧 MongoDB Connection Checker');
    console.log('==============================\n');
    
    const isConnected = await checkMongoDBConnection();
    
    if (!isConnected) {
        console.log('\n🔄 Attempting to start MongoDB automatically...');
        const started = await startMongoDB();
        
        if (started) {
            console.log('\n✅ MongoDB should now be running. Running seed script...');
            // Import and run the seed script
            const { seedDatabase } = require('./seedDatabase-FULLY-FIXED.js');
            await seedDatabase();
        } else {
            console.log('\n❌ Please start MongoDB manually and run the seed script again.');
            console.log('   Command: node seedDatabase-FULLY-FIXED.js');
        }
    } else {
        console.log('\n✅ MongoDB is running. Running seed script...');
        const { seedDatabase } = require('./seedDatabase.js');
        await seedDatabase();
    }
}

main();