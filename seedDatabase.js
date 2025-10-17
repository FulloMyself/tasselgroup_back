// seedDatabase.js - Complete database seeding for Tassel Group
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tasselgroup';

// Import models
const User = require('./models/User');
const Product = require('./models/Product');
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const Order = require('./models/Order');
const Voucher = require('./models/Voucher');
const GiftPackage = require('./models/GiftPackage');
const GiftOrder = require('./models/GiftOrder');

const connectDB = async () => {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB connected successfully!');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

const clearDatabase = async () => {
    try {
        console.log('🗑️  Clearing existing database...');
        await mongoose.connection.db.dropDatabase();
        console.log('✅ Database cleared successfully');
    } catch (error) {
        console.error('❌ Error clearing database:', error.message);
        throw error;
    }
};

const createUsers = async () => {
    const users = [
        {
            name: 'Admin User',
            email: 'admin@tasselgroup.co.za',
            password: await bcrypt.hash('admin123', 12),
            role: 'admin',
            phone: '+27 21 123 4567',
            address: '123 Admin Street, Cape Town'
        },
        {
            name: 'Sarah Johnson',
            email: 'sarah@tasselgroup.co.za',
            password: await bcrypt.hash('staff123', 12),
            role: 'staff',
            phone: '+27 21 123 4568',
            address: '124 Staff Street, Cape Town'
        },
        {
            name: 'Michael Brown',
            email: 'michael@tasselgroup.co.za',
            password: await bcrypt.hash('staff123', 12),
            role: 'staff',
            phone: '+27 21 123 4569',
            address: '125 Staff Street, Cape Town'
        },
        {
            name: 'Emma Wilson',
            email: 'emma@tasselgroup.co.za',
            password: await bcrypt.hash('staff123', 12),
            role: 'staff',
            phone: '+27 21 123 4570',
            address: '126 Staff Street, Cape Town'
        },
        {
            name: 'John Smith',
            email: 'john.smith@email.com',
            password: await bcrypt.hash('customer123', 12),
            role: 'customer',
            phone: '+27 21 123 4571',
            address: '127 Customer Avenue, Cape Town'
        },
        {
            name: 'Lisa Davis',
            email: 'lisa.davis@email.com',
            password: await bcrypt.hash('customer123', 12),
            role: 'customer',
            phone: '+27 21 123 4572',
            address: '128 Customer Road, Cape Town'
        }
    ];

    const createdUsers = await User.insertMany(users);
    console.log(`✅ ${createdUsers.length} users created`);
    return createdUsers;
};

const createProducts = async () => {
    const products = [
        {
            name: 'Luxury Body Lotion',
            description: 'Nourishing body lotion with natural ingredients',
            price: 450,
            category: 'skincare',
            image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            inStock: true,
            stockQuantity: 50
        },
        {
            name: 'Aromatherapy Candle Set',
            description: 'Set of 3 luxury scented candles',
            price: 680,
            category: 'wellness',
            image: 'https://images.unsplash.com/photo-1545979437-94e47d7bc7ab?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            inStock: true,
            stockQuantity: 30
        },
        {
            name: 'Premium Hair Serum',
            description: 'Advanced hair serum for shine and frizz control',
            price: 520,
            category: 'haircare',
            image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            inStock: true,
            stockQuantity: 40
        },
        {
            name: 'Facial Cleansing Kit',
            description: 'Complete facial cleansing routine',
            price: 890,
            category: 'skincare',
            image: 'https://images.unsplash.com/photo-1556228577-7a29e24d5af3?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            inStock: true,
            stockQuantity: 25
        },
        {
            name: 'Bath Salt Collection',
            description: 'Luxury mineral bath salts in 4 scents',
            price: 380,
            category: 'wellness',
            image: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            inStock: true,
            stockQuantity: 60
        }
    ];

    const createdProducts = await Product.insertMany(products);
    console.log(`✅ ${createdProducts.length} products created`);
    return createdProducts;
};

const createServices = async () => {
    const services = [
        {
            name: 'Classic Haircut',
            description: 'Professional haircut with styling and consultation',
            price: 350,
            duration: '45 min',
            category: 'haircare', // FIXED: Changed from 'hair' to 'haircare'
            image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        },
        {
            name: 'Premium Hair Coloring',
            description: 'Full hair coloring service with premium products',
            price: 1200,
            duration: '120 min',
            category: 'haircare', // FIXED: Changed from 'color' to 'haircare'
            image: 'https://images.unsplash.com/photo-1560869713-7d9aea7ebcd6?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        },
        {
            name: 'Deep Conditioning Treatment',
            description: 'Intensive hair treatment for damaged hair',
            price: 450,
            duration: '60 min',
            category: 'haircare', // FIXED: Changed from 'treatment' to 'haircare'
            image: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        },
        {
            name: 'Bridal Makeup',
            description: 'Special occasion bridal makeup application',
            price: 1500,
            duration: '90 min',
            category: 'makeup', // FIXED: Changed from 'styling' to 'makeup'
            image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        },
        {
            name: 'Relaxing Massage',
            description: 'Full body relaxing massage therapy',
            price: 800,
            duration: '60 min',
            category: 'massage', // NEW: Added massage service
            image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        },
        {
            name: 'Spa Pedicure',
            description: 'Luxury foot care with massage and paraffin wax',
            price: 550,
            duration: '60 min',
            category: 'nails', // NEW: Added nails service
            image: 'https://images.unsplash.com/photo-1607778833979-4f2a0ee42b7c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        },
        {
            name: 'Anti-Aging Facial',
            description: 'Luxury facial treatment with collagen-boosting ingredients',
            price: 750,
            duration: '45 min',
            category: 'skincare', // NEW: Added skincare service
            image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80'
        }
    ];

    const createdServices = await Service.insertMany(services);
    console.log(`✅ ${createdServices.length} services created`);
    return createdServices;
};

const createGiftPackages = async (services, products) => {
    const giftPackages = [
        {
            name: 'Complete Hair Makeover',
            description: 'Full hair transformation package',
            basePrice: 2500,
            image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            includes: [
                'Professional Haircut & Styling',
                'Premium Hair Coloring',
                'Deep Conditioning Treatment',
                'Styling Products Kit'
            ],
            services: [services[0]._id, services[1]._id, services[2]._id],
            products: [products[2]._id],
            customizable: true
        },
        {
            name: 'Bridal Beauty Package',
            description: 'Complete bridal preparation package',
            basePrice: 3200,
            image: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            includes: [
                'Bridal Makeup Application',
                'Professional Hair Styling',
                'Manicure & Pedicure',
                'Pre-wedding Skincare'
            ],
            services: [services[3]._id, services[0]._id, services[6]._id],
            products: [products[0]._id, products[2]._id],
            customizable: true
        },
        {
            name: 'Spa Day Experience',
            description: 'Complete relaxation and wellness package',
            basePrice: 1800,
            image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80',
            includes: [
                'Relaxing Full Body Massage',
                'Revitalizing Facial Treatment',
                'Spa Pedicure',
                'Aromatherapy Experience'
            ],
            services: [services[4]._id, services[6]._id, services[5]._id],
            products: [products[1]._id, products[4]._id],
            customizable: true
        }
    ];

    const createdGiftPackages = await GiftPackage.insertMany(giftPackages);
    console.log(`✅ ${createdGiftPackages.length} gift packages created`);
    return createdGiftPackages;
};

const createVouchers = async (staffUsers) => {
    const vouchers = [
        {
            code: 'WELCOME20',
            discount: 20,
            type: 'percentage',
            maxUses: 100,
            usedCount: 25,
            isActive: true,
            validUntil: new Date('2025-12-31'),
            description: 'Welcome discount for new customers'
        },
        {
            code: 'SPA25',
            discount: 25,
            type: 'percentage',
            maxUses: 50,
            usedCount: 18,
            isActive: true,
            validUntil: new Date('2025-11-30'),
            description: 'Special spa package discount'
        },
        {
            code: 'FIRST50',
            discount: 50,
            type: 'fixed',
            maxUses: 30,
            usedCount: 12,
            isActive: true,
            validUntil: new Date('2025-10-31'),
            description: 'First-time booking discount'
        },
        {
            code: 'STAFF100',
            discount: 100,
            type: 'fixed',
            maxUses: 20,
            usedCount: 5,
            isActive: true,
            validUntil: new Date('2025-12-31'),
            assignedTo: staffUsers[0]._id,
            description: 'Staff appreciation voucher'
        }
    ];

    const createdVouchers = await Voucher.insertMany(vouchers);
    console.log(`✅ ${createdVouchers.length} vouchers created`);
    return createdVouchers;
};

const createBookings = async (users, services, staffUsers) => {
    const bookings = [];
    const statuses = ['completed', 'completed', 'completed', 'confirmed', 'pending'];
    const times = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    
    for (let i = 0; i < 25; i++) {
        const customer = users[4 + Math.floor(Math.random() * 2)];
        const service = services[Math.floor(Math.random() * services.length)];
        const staff = staffUsers[Math.floor(Math.random() * staffUsers.length)];
        
        const bookingDate = new Date();
        bookingDate.setMonth(bookingDate.getMonth() - Math.floor(Math.random() * 6));
        bookingDate.setDate(bookingDate.getDate() - Math.floor(Math.random() * 30));
        
        const booking = {
            user: customer._id,
            service: service._id,
            staff: staff._id,
            date: bookingDate,
            time: times[Math.floor(Math.random() * times.length)],
            duration: service.duration,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            price: service.price,
            specialRequests: i % 3 === 0 ? 'Please provide extra towels' : '',
            createdAt: bookingDate,
            updatedAt: bookingDate
        };
        
        bookings.push(booking);
    }

    const createdBookings = await Booking.insertMany(bookings);
    console.log(`✅ ${createdBookings.length} bookings created`);
    return createdBookings;
};

const createOrders = async (users, products, staffUsers, vouchers) => {
    const orders = [];
    const statuses = ['delivered', 'delivered', 'shipped', 'confirmed', 'pending'];
    const paymentMethods = ['card', 'cash', 'bank_transfer'];
    
    for (let i = 0; i < 20; i++) {
        const customer = users[4 + Math.floor(Math.random() * 2)];
        const staff = Math.random() > 0.3 ? staffUsers[Math.floor(Math.random() * staffUsers.length)] : null;
        const useVoucher = Math.random() > 0.7;
        const voucher = useVoucher ? vouchers[Math.floor(Math.random() * vouchers.length)] : null;
        
        const itemCount = Math.floor(Math.random() * 3) + 1;
        const items = [];
        let subtotal = 0;
        
        for (let j = 0; j < itemCount; j++) {
            const product = products[Math.floor(Math.random() * products.length)];
            const quantity = Math.floor(Math.random() * 2) + 1;
            items.push({
                product: product._id,
                quantity: quantity,
                price: product.price
            });
            subtotal += product.price * quantity;
        }
        
        let discount = 0;
        if (voucher) {
            if (voucher.type === 'percentage') {
                discount = (subtotal * voucher.discount) / 100;
            } else {
                discount = voucher.discount;
            }
            discount = Math.min(discount, subtotal);
        }
        
        const finalTotal = subtotal - discount;
        
        const orderDate = new Date();
        orderDate.setMonth(orderDate.getMonth() - Math.floor(Math.random() * 6));
        orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));
        
        const order = {
            user: customer._id,
            items: items,
            total: subtotal,
            finalTotal: finalTotal,
            discount: discount,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            shippingAddress: customer.address,
            paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
            processedBy: staff ? staff._id : null,
            voucher: voucher ? voucher._id : null,
            createdAt: orderDate,
            updatedAt: orderDate
        };
        
        orders.push(order);
    }

    const createdOrders = await Order.insertMany(orders);
    console.log(`✅ ${createdOrders.length} orders created`);
    return createdOrders;
};

const createGiftOrders = async (users, giftPackages, staffUsers) => {
    const giftOrders = [];
    const statuses = ['delivered', 'confirmed', 'pending'];
    
    for (let i = 0; i < 8; i++) {
        const customer = users[4 + Math.floor(Math.random() * 2)];
        const giftPackage = giftPackages[Math.floor(Math.random() * giftPackages.length)];
        const staff = Math.random() > 0.5 ? staffUsers[Math.floor(Math.random() * staffUsers.length)] : null;
        
        const orderDate = new Date();
        orderDate.setMonth(orderDate.getMonth() - Math.floor(Math.random() * 3));
        orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));
        
        const deliveryDate = new Date(orderDate);
        deliveryDate.setDate(deliveryDate.getDate() + 7);
        
        const giftOrder = {
            user: customer._id,
            giftPackage: giftPackage._id,
            recipientName: ['Jane Doe', 'Mike Johnson', 'Sarah Wilson', 'David Brown'][i % 4],
            recipientEmail: ['jane@email.com', 'mike@email.com', 'sarah@email.com', 'david@email.com'][i % 4],
            message: 'Hope you enjoy this relaxing experience!',
            deliveryDate: deliveryDate,
            price: giftPackage.basePrice,
            status: statuses[Math.floor(Math.random() * statuses.length)],
            assignedStaff: staff ? staff._id : null,
            createdAt: orderDate,
            updatedAt: orderDate
        };
        
        giftOrders.push(giftOrder);
    }

    const createdGiftOrders = await GiftOrder.insertMany(giftOrders);
    console.log(`✅ ${createdGiftOrders.length} gift orders created`);
    return createdGiftOrders;
};

const seedDatabase = async () => {
    try {
        console.log('🌱 STARTING COMPLETE DATABASE SEEDING...');
        
        await connectDB();
        await clearDatabase();
        
        const users = await createUsers();
        const products = await createProducts();
        const services = await createServices();
        const giftPackages = await createGiftPackages(services, products);
        
        const staffUsers = users.filter(user => user.role === 'staff');
        const customerUsers = users.filter(user => user.role === 'customer');
        
        const vouchers = await createVouchers(staffUsers);
        const bookings = await createBookings(users, services, staffUsers);
        const orders = await createOrders(users, products, staffUsers, vouchers);
        const giftOrders = await createGiftOrders(users, giftPackages, staffUsers);
        
        console.log('\n🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
        console.log('📊 SUMMARY:');
        console.log(`   👥 Users: ${users.length} (${staffUsers.length} staff, ${customerUsers.length} customers)`);
        console.log(`   📦 Products: ${products.length}`);
        console.log(`   💇 Services: ${services.length}`);
        console.log(`   🎁 Gift Packages: ${giftPackages.length}`);
        console.log(`   🎫 Vouchers: ${vouchers.length}`);
        console.log(`   📅 Bookings: ${bookings.length}`);
        console.log(`   🛒 Orders: ${orders.length}`);
        console.log(`   🎀 Gift Orders: ${giftOrders.length}`);
        
        const completedBookings = bookings.filter(b => b.status === 'completed');
        const deliveredOrders = orders.filter(o => o.status === 'delivered');
        const deliveredGiftOrders = giftOrders.filter(g => g.status === 'delivered');
        
        const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.finalTotal, 0) +
                           completedBookings.reduce((sum, booking) => sum + (booking.price || 0), 0) +
                           deliveredGiftOrders.reduce((sum, gift) => sum + (gift.price || 0), 0);
        
        console.log(`   💰 Total Revenue: R ${totalRevenue.toFixed(2)}`);
        
        console.log('\n🔑 TEST LOGINS:');
        console.log('   Admin: admin@tasselgroup.co.za / admin123');
        console.log('   Staff: sarah@tasselgroup.co.za / staff123');
        console.log('   Customer: john.smith@email.com / customer123');
        
        console.log('\n📈 DASHBOARD READY: All charts should now work with real data!');
        
    } catch (error) {
        console.error('❌ DATABASE SEEDING FAILED:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        process.exit(0);
    }
};

if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };