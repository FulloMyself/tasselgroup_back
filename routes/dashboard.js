const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Voucher = require('../models/Voucher');
const GiftOrder = require('../models/GiftOrder');
const { auth, adminAuth, staffAuth } = require('../middleware/auth');

const router = express.Router();

// Helper function for safe counting
const safeCount = async (Model) => {
  try {
    return await Model.countDocuments();
  } catch (error) {
    console.error(`Error counting ${Model.modelName}:`, error);
    return 0;
  }
};

// Admin dashboard stats - FIXED VERSION
router.get('/admin', adminAuth, async (req, res) => {
  try {
    console.log('📊 Loading admin dashboard for:', req.user.name);

    // Use Promise.all for parallel queries
    const [
      users,
      products,
      services,
      bookings,
      orders,
      giftOrders,
      vouchers,
    ] = await Promise.all([
      User.find().lean(),
      Product.find().lean(),
      Service.find().lean(),
      Booking.find()
        .populate('user', 'name email')
        .populate('service', 'name')
        .lean(),
      Order.find()
        .populate('user', 'name email')
        .populate('items.product', 'name price')
        .lean(),
      GiftOrder.find()
        .populate('giftPackage', 'basePrice')
        .lean(),
      Voucher.find()
        .populate('assignedTo', 'name email')
        .lean()
    ]);

    console.log('📊 Data loaded:', {
      users: users.length,
      products: products.length,
      services: services.length,
      bookings: bookings.length,
      orders: orders.length,
      giftOrders: giftOrders.length,
      vouchers: vouchers.length
    });

    // Calculate stats
    const totalUsers = users.length;
    const totalProducts = products.length;
    const totalServices = services.length;
    const totalBookings = bookings.length;
    const totalOrders = orders.length;
    const totalGiftOrders = giftOrders.length;

    // Calculate total revenue from all sources
    const ordersRevenue = orders.reduce((sum, order) => sum + (order.finalTotal || order.total || 0), 0);
    const bookingsRevenue = bookings.reduce((sum, booking) => sum + (booking.price || 0), 0);
    const giftOrdersRevenue = giftOrders.reduce((sum, giftOrder) => sum + (giftOrder.price || 0), 0);
    const totalRevenue = ordersRevenue + bookingsRevenue + giftOrdersRevenue;

    console.log('💰 Revenue Breakdown:', {
      orders: ordersRevenue,
      bookings: bookingsRevenue,
      giftOrders: giftOrdersRevenue,
      total: totalRevenue
    });

    // Monthly revenue calculation
    const monthlyRevenue = calculateMonthlyRevenue(orders, bookings, giftOrders);
    console.log('📈 Monthly Revenue Data:', monthlyRevenue);

    // Get recent activity
    const recentBookings = bookings
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const recentOrders = orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    // Staff performance
    const staffUsers = users.filter(user => user.role === 'staff');
    const staffPerformance = calculateStaffPerformance(bookings, staffUsers);

    // Popular services
    const popularServices = calculatePopularServices(bookings);

    res.json({
      stats: {
        totalUsers,
        totalProducts,
        totalServices,
        totalBookings,
        totalOrders,
        totalGiftOrders,
        totalRevenue,
        revenueBreakdown: {
          orders: ordersRevenue,
          bookings: bookingsRevenue,
          giftOrders: giftOrdersRevenue
        }
      },
      monthlyRevenue,
      recentBookings,
      recentOrders,
      staffPerformance,
      popularServices
    });

  } catch (error) {
    console.error('❌ Admin dashboard error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error loading dashboard', 
      error: error.message 
    });
  }
});

router.get('/staff', staffAuth, async (req, res) => {
  try {
    console.log('👨‍💼 Loading staff dashboard for:', req.user.name);

    // Get all data first
    const [allBookings, allOrders, vouchers] = await Promise.all([
      Booking.find()
        .populate('user', 'name email phone')
        .populate('service', 'name price duration')
        .lean(),
      Order.find()
        .populate('user', 'name email')
        .populate('items.product', 'name price')
        .lean(),
      Voucher.find({ assignedTo: req.user._id }).lean()
    ]);

    // Filter for current staff member
    const staffBookings = allBookings.filter(booking =>
      booking.staff && booking.staff.toString() === req.user._id.toString()
    );

    // Calculate stats
    const totalSales = staffBookings.length;
    const uniqueClients = [...new Set(staffBookings.map(booking => booking.user?._id?.toString()))].filter(Boolean);
    const totalClients = uniqueClients.length;

    // Calculate total hours worked
    let totalHours = 0;
    staffBookings.forEach(booking => {
      if (booking.duration) {
        const durationMatch = booking.duration.match(/(\d+)/);
        if (durationMatch) {
          totalHours += parseInt(durationMatch[1]) / 60;
        }
      }
    });

    // Calculate commission (15% of total booking value)
    const totalCommission = staffBookings.reduce((sum, booking) => sum + (booking.price * 0.15), 0);

    // Upcoming appointments
    const upcomingAppointments = staffBookings
      .filter(booking => {
        const bookingDate = new Date(booking.date);
        return bookingDate >= new Date() &&
          ['pending', 'confirmed'].includes(booking.status);
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);

    // Recent sales
    const recentSales = allOrders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    res.json({
      success: true,
      stats: {
        totalSales,
        totalClients,
        totalHours: Math.round(totalHours),
        totalCommission: Math.round(totalCommission)
      },
      upcomingAppointments,
      recentSales,
      myVouchers: vouchers
    });

  } catch (error) {
    console.error('❌ Staff dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error loading staff dashboard',
      error: error.message
    });
  }
});

// Helper functions
function calculateMonthlyRevenue(orders, bookings, giftOrders) {
  const monthlyRevenue = [];
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = month.toLocaleString('default', { month: 'short' }) + ' ' + month.getFullYear().toString().slice(-2);
    
    // Revenue from ORDERS
    const monthOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate.getMonth() === month.getMonth() && 
             orderDate.getFullYear() === month.getFullYear();
    });
    const ordersRevenue = monthOrders.reduce((sum, order) => sum + (order.finalTotal || order.total || 0), 0);
    
    // Revenue from BOOKINGS
    const monthBookings = bookings.filter(booking => {
      const bookingDate = new Date(booking.createdAt);
      return bookingDate.getMonth() === month.getMonth() && 
             bookingDate.getFullYear() === month.getFullYear();
    });
    const bookingsRevenue = monthBookings.reduce((sum, booking) => sum + (booking.price || 0), 0);
    
    // Revenue from GIFT ORDERS
    const monthGiftOrders = giftOrders.filter(giftOrder => {
      const giftOrderDate = new Date(giftOrder.createdAt);
      return giftOrderDate.getMonth() === month.getMonth() && 
             giftOrderDate.getFullYear() === month.getFullYear();
    });
    const giftOrdersRevenue = monthGiftOrders.reduce((sum, giftOrder) => sum + (giftOrder.price || 0), 0);
    
    // TOTAL revenue
    const totalRevenue = ordersRevenue + bookingsRevenue + giftOrdersRevenue;
    
    monthlyRevenue.push({
      _id: month.getMonth() + 1,
      revenue: totalRevenue,
      monthName: monthName,
      breakdown: {
        orders: ordersRevenue,
        bookings: bookingsRevenue,
        giftOrders: giftOrdersRevenue
      }
    });
  }
  
  return monthlyRevenue.reverse();
}

function calculateStaffPerformance(bookings, staffUsers) {
  return staffUsers.map(staff => {
    const staffBookings = bookings.filter(booking => 
      booking.staff && booking.staff.toString() === staff._id.toString()
    );
    const staffRevenue = staffBookings.reduce((sum, booking) => sum + (booking.price || 0), 0);
    
    return {
      name: staff.name,
      email: staff.email,
      totalBookings: staffBookings.length,
      totalRevenue: staffRevenue
    };
  });
}

function calculatePopularServices(bookings) {
  const serviceCounts = {};
  bookings.forEach(booking => {
    if (booking.service && booking.service.name) {
      serviceCounts[booking.service.name] = (serviceCounts[booking.service.name] || 0) + 1;
    }
  });
  
  return Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// Public stats endpoint (no auth required for basic stats)
router.get('/public-stats', async (req, res) => {
  try {
    const [users, products, services] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Service.countDocuments()
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers: users,
        totalProducts: products,
        totalServices: services
      }
    });
  } catch (error) {
    console.error('Public stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading public stats'
    });
  }
});

module.exports = router;