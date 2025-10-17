const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Voucher = require('../models/Voucher');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tassel-group';

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Product.deleteMany({});
    await Service.deleteMany({});
    await Voucher.deleteMany({});
    console.log('Existing data cleared');

    // Create admin user with Tassel Group email format
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@tasselgroup.co.za',
      password: await bcrypt.hash('admin123', 12),
      role: 'admin',
      phone: '+27123456789'
    });
    await adminUser.save();
    console.log('Admin user created');

    // Create staff users with Tassel Group email format
    const staffUsers = [
      {
        name: 'Sarah Johnson',
        email: 'sarah@tasselgroup.co.za',
        password: await bcrypt.hash('staff123', 12),
        role: 'staff',
        phone: '+27123456780',
        specialization: 'Hair Stylist'
      },
      {
        name: 'Michael Brown',
        email: 'michael@tasselgroup.co.za',
        password: await bcrypt.hash('staff123', 12),
        role: 'staff',
        phone: '+27123456781',
        specialization: 'Spa Therapist'
      },
      {
        name: 'Lisa Davis',
        email: 'lisa@tasselgroup.co.za',
        password: await bcrypt.hash('staff123', 12),
        role: 'staff',
        phone: '+27123456782',
        specialization: 'Nail Technician'
      }
    ];

    const savedStaffUsers = await User.insertMany(staffUsers);
    console.log('Staff users created');

    // Create customer users
    const customerUsers = [
      {
        name: 'Emma Wilson',
        email: 'emma@example.com',
        password: await bcrypt.hash('customer123', 12),
        role: 'customer',
        phone: '+27123456783'
      },
      {
        name: 'James Miller',
        email: 'james@example.com',
        password: await bcrypt.hash('customer123', 12),
        role: 'customer',
        phone: '+27123456784'
      },
      {
        name: 'Sophia Garcia',
        email: 'sophia@example.com',
        password: await bcrypt.hash('customer123', 12),
        role: 'customer',
        phone: '+27123456785'
      }
    ];

    await User.insertMany(customerUsers);
    console.log('Customer users created');

    // Create products for salon/spa business
    const products = [
      {
        name: 'Professional Hair Dryer',
        description: 'High-speed professional hair dryer with multiple heat settings',
        price: 899.99,
        category: 'Hair Tools',
        image: '/images/hair-dryer.jpg',
        inStock: true,
        stockQuantity: 15,
        tags: ['hair', 'styling', 'professional']
      },
      {
        name: 'Luxury Hair Serum',
        description: 'Premium hair serum for shine and protection',
        price: 249.99,
        category: 'Hair Care',
        image: '/images/hair-serum.jpg',
        inStock: true,
        stockQuantity: 30,
        tags: ['haircare', 'serum', 'luxury']
      },
      {
        name: 'Spa Massage Oil',
        description: 'Aromatherapy massage oil for relaxation',
        price: 189.99,
        category: 'Spa Products',
        image: '/images/massage-oil.jpg',
        inStock: true,
        stockQuantity: 25,
        tags: ['spa', 'massage', 'aromatherapy']
      },
      {
        name: 'Nail Polish Set',
        description: 'Professional nail polish set with 12 colors',
        price: 399.99,
        category: 'Nail Care',
        image: '/images/nail-polish.jpg',
        inStock: true,
        stockQuantity: 20,
        tags: ['nail', 'polish', 'beauty']
      },
      {
        name: 'Facial Cleanser',
        description: 'Gentle facial cleanser for all skin types',
        price: 179.99,
        category: 'Skincare',
        image: '/images/facial-cleanser.jpg',
        inStock: false,
        stockQuantity: 0,
        tags: ['skincare', 'facial', 'cleanser']
      },
      {
        name: 'Makeup Brush Set',
        description: 'Complete professional makeup brush collection',
        price: 599.99,
        category: 'Makeup',
        image: '/images/makeup-brushes.jpg',
        inStock: true,
        stockQuantity: 12,
        tags: ['makeup', 'brushes', 'professional']
      }
    ];

    const savedProducts = await Product.insertMany(products);
    console.log('Products created');

    // Create services for salon/spa
    const services = [
      {
        name: 'Women\'s Haircut & Style',
        description: 'Professional haircut with blow-dry styling',
        price: 350.00,
        duration: 60,
        category: 'Hair',
        staff: [savedStaffUsers[0]._id],
        image: '/images/haircut-service.jpg'
      },
      {
        name: 'Men\'s Haircut',
        description: 'Classic men\'s haircut and styling',
        price: 200.00,
        duration: 30,
        category: 'Hair',
        staff: [savedStaffUsers[0]._id],
        image: '/images/mens-haircut.jpg'
      },
      {
        name: 'Full Body Massage',
        description: '60-minute relaxing full body massage',
        price: 450.00,
        duration: 60,
        category: 'Spa',
        staff: [savedStaffUsers[1]._id],
        image: '/images/body-massage.jpg'
      },
      {
        name: 'Anti-Aging Facial',
        description: 'Luxury facial treatment with anti-aging properties',
        price: 380.00,
        duration: 45,
        category: 'Skincare',
        staff: [savedStaffUsers[1]._id],
        image: '/images/facial-treatment.jpg'
      },
      {
        name: 'Manicure & Pedicure',
        description: 'Complete hand and foot care with polish',
        price: 280.00,
        duration: 75,
        category: 'Nails',
        staff: [savedStaffUsers[2]._id],
        image: '/images/manicure-pedicure.jpg'
      },
      {
        name: 'Gel Nails',
        description: 'Long-lasting gel nail application',
        price: 320.00,
        duration: 60,
        category: 'Nails',
        staff: [savedStaffUsers[2]._id],
        image: '/images/gel-nails.jpg'
      },
      {
        name: 'Bridal Makeup',
        description: 'Professional bridal makeup application',
        price: 650.00,
        duration: 90,
        category: 'Makeup',
        staff: [savedStaffUsers[0]._id, savedStaffUsers[1]._id],
        image: '/images/bridal-makeup.jpg'
      }
    ];

    const savedServices = await Service.insertMany(services);
    console.log('Services created');

    // Create vouchers
    const vouchers = [
      {
        code: 'WELCOME10',
        discountType: 'percentage',
        discountValue: 10,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        assignedTo: savedStaffUsers[0]._id,
        isActive: true,
        description: 'Welcome discount for new customers'
      },
      {
        code: 'SUMMER25',
        discountType: 'percentage',
        discountValue: 25,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        assignedTo: savedStaffUsers[1]._id,
        isActive: true,
        description: 'Summer special discount'
      },
      {
        code: 'FIXED200',
        discountType: 'fixed',
        discountValue: 200,
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        assignedTo: savedStaffUsers[2]._id,
        isActive: true,
        description: 'R200 off any service'
      },
      {
        code: 'STAFF20',
        discountType: 'percentage',
        discountValue: 20,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        assignedTo: savedStaffUsers[0]._id,
        isActive: true,
        description: 'Staff special discount'
      },
      {
        code: 'FIRSTVISIT15',
        discountType: 'percentage',
        discountValue: 15,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        isActive: true,
        description: 'First visit discount for new clients'
      }
    ];

    const savedVouchers = await Voucher.insertMany(vouchers);
    console.log('Vouchers created');

    console.log('\n=== TASSEL GROUP SEED DATA SUMMARY ===');
    console.log(`👑 Admin Users: 1 (admin@tasselgroup.co.za / admin123)`);
    console.log(`👥 Staff Users: 3 (sarah@tasselgroup.co.za, michael@tasselgroup.co.za, lisa@tasselgroup.co.za / staff123)`);
    console.log(`👤 Customer Users: 3 (emma@example.com, james@example.com, sophia@example.com / customer123)`);
    console.log(`🛍️ Products: ${savedProducts.length}`);
    console.log(`💅 Services: ${savedServices.length}`);
    console.log(`🎫 Vouchers: ${savedVouchers.length}`);
    console.log('=====================================\n');

    console.log('✅ Tassel Group database seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📡 Database connection closed');
  }
};

// Run seed if this file is executed directly
if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = seedData;