const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// SINGLE CORS Configuration - Clean and Simple
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000', 
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'https://fullomyself.github.io',
        'https://fullomyself.github.io/tasselgroupwebapplication'
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
};

app.use(cors(corsOptions));

// ADD THIS LINE: Handle preflight requests globally
app.options('*', cors(corsOptions));

// Make sure this comes BEFORE your routes
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection - KEEP EXACTLY AS IS SINCE IT WORKS
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

connectDB();

// MongoDB Models
const User = require('./models/User');
const Product = require('./models/Product');
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const Order = require('./models/Order');
const Voucher = require('./models/Voucher');
const GiftPackage = require('./models/GiftPackage');
const GiftOrder = require('./models/GiftOrder');

// Auth Middleware
const auth = require('./middleware/auth');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/services', require('./routes/services'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/vouchers', require('./routes/vouchers'));
app.use('/api/gift-packages', require('./routes/giftPackages'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/gift-orders', require('./routes/giftOrders'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Tassel Group API is running',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Tassel Group API',
        version: '1.0.0',
        environment: process.env.NODE_ENV
    });
});

// TEMPORARY PRODUCTION SEED ENDPOINT - REMOVE AFTER USE
app.post('/api/seed-production', async (req, res) => {
    try {
        console.log('🌱 STARTING PRODUCTION SEEDING...');
        
        // Import seed function
        const { seedDatabase } = require('./seedDatabase');
        
        // Run the seed
        await seedDatabase();
        
        console.log('✅ PRODUCTION DATABASE SEEDED SUCCESSFULLY');
        res.json({ 
            success: true, 
            message: 'Production database seeded successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ PRODUCTION SEEDING FAILED:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 CORS configured for:`, corsOptions.origin);
});