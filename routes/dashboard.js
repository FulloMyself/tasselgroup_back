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

    // Use Promise.all for parallel queries - FIXED POPULATION
    const [
      users,
      products,
      services,
      allBookings,
      allOrders,
      allGiftOrders,
      vouchers,
    ] = await Promise.all([
      User.find().lean(),
      Product.find().lean(),
      Service.find().lean(),
      Booking.find()
        .populate('user', 'name email')
        .populate('service', 'name price')
        .populate('staff', 'name')
        .lean(),
      // FIXED: Remove assignedStaff population since it doesn't exist in Order schema
      Order.find()
        .populate('user', 'name email')
        .populate('items.product', 'name price')
        .lean(),
      // FIXED: Remove assignedStaff population for gift orders if it doesn't exist
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
      bookings: allBookings.length,
      orders: allOrders.length,
      giftOrders: allGiftOrders.length,
      vouchers: vouchers.length
    });

  
const revenueOrders = allOrders.filter(order => 
  order.status === 'paid' || order.status === 'pending' || order.status === 'delivered' || order.status === 'completed'
);
    
    const revenueBookings = allBookings.filter(booking => 
      booking.status === 'completed' || booking.status === 'confirmed'
    );
    
    const revenueGiftOrders = allGiftOrders.filter(giftOrder => 
      giftOrder.status === 'completed' || giftOrder.status === 'delivered' || giftOrder.status === 'paid'
    );

    console.log('✅ Filtered revenue data:', {
      revenueOrders: revenueOrders.length,
      revenueBookings: revenueBookings.length,
      revenueGiftOrders: revenueGiftOrders.length
    });

    // Calculate stats
    const totalUsers = users.length;
    const totalProducts = products.length;
    const totalServices = services.length;
    const totalBookings = allBookings.length;
    const totalOrders = allOrders.length;
    const totalGiftOrders = allGiftOrders.length;

    // Calculate total revenue from ALL PAID sources - FIXED
    const ordersRevenue = revenueOrders.reduce((sum, order) => {
      const orderTotal = order.finalTotal || order.total || order.totalAmount || 0;
      console.log(`💰 Order ${order._id}: R${orderTotal} (status: ${order.status})`);
      return sum + orderTotal;
    }, 0);
    
    const bookingsRevenue = revenueBookings.reduce((sum, booking) => {
      const bookingPrice = booking.price || 0;
      console.log(`💰 Booking ${booking._id}: R${bookingPrice} (status: ${booking.status})`);
      return sum + bookingPrice;
    }, 0);
    
    const giftOrdersRevenue = revenueGiftOrders.reduce((sum, giftOrder) => {
      const giftPrice = giftOrder.price || giftOrder.total || 0;
      console.log(`💰 Gift Order ${giftOrder._id}: R${giftPrice} (status: ${giftOrder.status})`);
      return sum + giftPrice;
    }, 0);
    
    const totalRevenue = ordersRevenue + bookingsRevenue + giftOrdersRevenue;

    console.log('💰 Revenue Breakdown:', {
      orders: ordersRevenue,
      bookings: bookingsRevenue,
      giftOrders: giftOrdersRevenue,
      total: totalRevenue
    });

    // Monthly revenue calculation - FIXED to use paid orders only
    const monthlyRevenue = calculateMonthlyRevenue(revenueOrders, revenueBookings, revenueGiftOrders);
    console.log('📈 Monthly Revenue Data:', monthlyRevenue);

  

    // Get recent activity - include all for display
    const recentBookings = allBookings
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const recentOrders = allOrders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    // Staff performance - FIXED to handle missing assignedStaff field
    const staffUsers = users.filter(user => user.role === 'staff');
    const staffPerformance = calculateStaffPerformance(allBookings, allOrders, allGiftOrders, staffUsers);

    // Popular services - FIXED
    const popularServices = calculatePopularServices(allBookings);

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

// Staff dashboard - FIXED
router.get('/staff', staffAuth, async (req, res) => {
  try {
    console.log('👨‍💼 Loading staff dashboard for:', req.user.name);

    // Get all data first - FIXED POPULATION
    const [allBookings, allOrders, allGiftOrders, vouchers] = await Promise.all([
      Booking.find()
        .populate('user', 'name email phone')
        .populate('service', 'name price duration')
        .lean(),
      // FIXED: Remove assignedStaff population
      Order.find()
        .populate('user', 'name email')
        .populate('items.product', 'name price')
        .lean(),
      // FIXED: Remove assignedStaff population
      GiftOrder.find()
        .populate('user', 'name email')
        .populate('giftPackage', 'name basePrice')
        .lean(),
      Voucher.find({ assignedTo: req.user._id }).lean()
    ]);

    // Filter for current staff member across all revenue sources
    const staffBookings = allBookings.filter(booking =>
      booking.staff && booking.staff.toString() === req.user._id.toString()
    );

    // FIXED: Use processedBy instead of assignedStaff for orders
    const staffOrders = allOrders.filter(order =>
      order.processedBy && order.processedBy.toString() === req.user._id.toString()
    );

    // FIXED: Check if assignedStaff exists before filtering
    const staffGiftOrders = allGiftOrders.filter(giftOrder =>
      giftOrder.assignedStaff && giftOrder.assignedStaff.toString() === req.user._id.toString()
    );

    // Calculate stats - INCLUDE ALL REVENUE SOURCES
    const totalSales = staffBookings.length + staffOrders.length + staffGiftOrders.length;
    const uniqueClients = [
      ...new Set([
        ...staffBookings.map(booking => booking.user?._id?.toString()),
        ...staffOrders.map(order => order.user?._id?.toString()),
        ...staffGiftOrders.map(giftOrder => giftOrder.user?._id?.toString())
      ])
    ].filter(Boolean);
    const totalClients = uniqueClients.length;

    // Calculate total hours worked from bookings
    let totalHours = 0;
    staffBookings.forEach(booking => {
      if (booking.duration) {
        const durationMatch = booking.duration.match(/(\d+)/);
        if (durationMatch) {
          totalHours += parseInt(durationMatch[1]) / 60;
        }
      }
    });

    // Calculate commission (15% of total value from all sources)
    const bookingCommission = staffBookings.reduce((sum, booking) => sum + (booking.price * 0.15), 0);
    const orderCommission = staffOrders.reduce((sum, order) => sum + ((order.finalTotal || order.total) * 0.15), 0);
    const giftCommission = staffGiftOrders.reduce((sum, giftOrder) => sum + ((giftOrder.price || giftOrder.total) * 0.15), 0);
    const totalCommission = bookingCommission + orderCommission + giftCommission;

    // Upcoming appointments
    const upcomingAppointments = staffBookings
      .filter(booking => {
        const bookingDate = new Date(booking.date);
        return bookingDate >= new Date() &&
          ['pending', 'confirmed'].includes(booking.status);
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);

    // Recent sales from all sources
    const recentSales = [
      ...staffOrders.map(order => ({
        type: 'product',
        description: `Sold ${order.items.length} products`,
        amount: order.finalTotal || order.total,
        date: order.createdAt
      })),
      ...staffBookings.map(booking => ({
        type: 'service',
        description: `Booked ${booking.service?.name}`,
        amount: booking.price,
        date: booking.createdAt
      })),
      ...staffGiftOrders.map(giftOrder => ({
        type: 'gift',
        description: `Sold gift package`,
        amount: giftOrder.price || giftOrder.total,
        date: giftOrder.createdAt
      }))
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    res.json({
      success: true,
      stats: {
        totalSales,
        totalClients,
        totalHours: Math.round(totalHours),
        totalCommission: Math.round(totalCommission),
        revenueBreakdown: {
          bookings: staffBookings.length,
          orders: staffOrders.length,
          giftOrders: staffGiftOrders.length
        }
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

// Helper functions - UPDATED
function calculateMonthlyRevenue(orders, bookings, giftOrders) {
  const monthlyRevenue = {};
  const now = new Date();

  // Create last 6 months
  for (let i = 0; i < 6; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = month.toLocaleString('default', { month: 'short' }) + ' ' + month.getFullYear();
    monthlyRevenue[monthKey] = 0;
  }

  // FIXED: Include pending orders in monthly revenue
  orders.forEach(order => {
    const orderDate = new Date(order.createdAt);
    const monthKey = orderDate.toLocaleString('default', { month: 'short' }) + ' ' + orderDate.getFullYear();
    if (monthlyRevenue[monthKey] !== undefined) {
      monthlyRevenue[monthKey] += order.finalTotal || order.total || order.totalAmount || 0;
    }
  });

  // Add revenue from bookings
  bookings.forEach(booking => {
    const bookingDate = new Date(booking.createdAt);
    const monthKey = bookingDate.toLocaleString('default', { month: 'short' }) + ' ' + bookingDate.getFullYear();
    if (monthlyRevenue[monthKey] !== undefined) {
      monthlyRevenue[monthKey] += booking.price || 0;
    }
  });

  // Add revenue from gift orders
  giftOrders.forEach(giftOrder => {
    const giftOrderDate = new Date(giftOrder.createdAt);
    const monthKey = giftOrderDate.toLocaleString('default', { month: 'short' }) + ' ' + giftOrderDate.getFullYear();
    if (monthlyRevenue[monthKey] !== undefined) {
      monthlyRevenue[monthKey] += giftOrder.price || giftOrder.total || 0;
    }
  });

  console.log('📈 Final monthly revenue:', monthlyRevenue);
  return monthlyRevenue;
}

function calculateStaffPerformance(bookings, orders, giftOrders, staffUsers) {
  return staffUsers.map(staff => {
    const staffBookings = bookings.filter(booking => 
      booking.staff && booking.staff.toString() === staff._id.toString()
    );
    
    // FIXED: Use processedBy instead of assignedStaff
    const staffOrders = orders.filter(order =>
      order.processedBy && order.processedBy.toString() === staff._id.toString()
    );
    
    // FIXED: Check if assignedStaff exists
    const staffGiftOrders = giftOrders.filter(giftOrder =>
      giftOrder.assignedStaff && giftOrder.assignedStaff.toString() === staff._id.toString()
    );

    const bookingRevenue = staffBookings.reduce((sum, booking) => sum + (booking.price || 0), 0);
    const orderRevenue = staffOrders.reduce((sum, order) => sum + (order.finalTotal || order.total || order.totalAmount || 0), 0);
    const giftRevenue = staffGiftOrders.reduce((sum, giftOrder) => sum + (giftOrder.price || giftOrder.total || 0), 0);
    
    const totalRevenue = bookingRevenue + orderRevenue + giftRevenue;
    
    return {
      name: staff.name,
      email: staff.email,
      totalBookings: staffBookings.length,
      totalOrders: staffOrders.length,
      totalGiftOrders: staffGiftOrders.length,
      totalRevenue: totalRevenue,
      breakdown: {
        bookings: bookingRevenue,
        orders: orderRevenue,
        gifts: giftRevenue
      }
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

// Function to sort monthly revenue data chronologically
function sortMonthlyRevenueData(monthlyRevenue) {
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    
    // Combine labels and data into sortable objects
    const combined = monthlyRevenue.labels.map((label, index) => ({
        label,
        data: monthlyRevenue.data[index],
        // Extract year and month for sorting
        year: parseInt(label.split(' ')[1]),
        month: months.indexOf(label.split(' ')[0])
    }));
    
    // Sort by year and month
    combined.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });
    
    // Return separated arrays
    return {
        labels: combined.map(item => item.label),
        data: combined.map(item => item.data)
    };
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

// Add this temporary debug route to your dashboard.js
router.get('/admin/debug-revenue', adminAuth, async (req, res) => {
  try {
    console.log('🔍 DEBUGGING REVENUE CALCULATION...');
    
    const allOrders = await Order.find().populate('user', 'name email').populate('items.product', 'name price').lean();
    const allBookings = await Booking.find().populate('user', 'name email').populate('service', 'name price').lean();
    const allGiftOrders = await GiftOrder.find().populate('giftPackage', 'basePrice').lean();

    // Debug: Show ALL orders and their amounts
    console.log('📦 ALL ORDERS:');
    allOrders.forEach((order, index) => {
      console.log(`   ${index + 1}. Order ${order._id}:`);
      console.log(`      Status: ${order.status}`);
      console.log(`      Total: ${order.total}`);
      console.log(`      Total Amount: ${order.totalAmount}`);
      console.log(`      Final Total: ${order.finalTotal}`);
      console.log(`      Created: ${order.createdAt}`);
    });

    // Calculate revenue from different statuses
    const paidOrders = allOrders.filter(order => order.status === 'paid');
    const deliveredOrders = allOrders.filter(order => order.status === 'delivered');
    const completedOrders = allOrders.filter(order => order.status === 'completed');
    const allStatusOrders = allOrders.filter(order => 
      order.status === 'paid' || order.status === 'delivered' || order.status === 'completed'
    );

    const revenueFromPaid = paidOrders.reduce((sum, order) => sum + (order.total || order.totalAmount || order.finalTotal || 0), 0);
    const revenueFromDelivered = deliveredOrders.reduce((sum, order) => sum + (order.total || order.totalAmount || order.finalTotal || 0), 0);
    const revenueFromCompleted = completedOrders.reduce((sum, order) => sum + (order.total || order.totalAmount || order.finalTotal || 0), 0);
    const revenueFromAll = allStatusOrders.reduce((sum, order) => sum + (order.total || order.totalAmount || order.finalTotal || 0), 0);

    console.log('💰 REVENUE BREAKDOWN:');
    console.log(`   Paid orders (${paidOrders.length}): R${revenueFromPaid}`);
    console.log(`   Delivered orders (${deliveredOrders.length}): R${revenueFromDelivered}`);
    console.log(`   Completed orders (${completedOrders.length}): R${revenueFromCompleted}`);
    console.log(`   All valid orders (${allStatusOrders.length}): R${revenueFromAll}`);

    res.json({
      success: true,
      debug: {
        allOrdersCount: allOrders.length,
        paidOrdersCount: paidOrders.length,
        deliveredOrdersCount: deliveredOrders.length,
        completedOrdersCount: completedOrders.length,
        revenueFromPaid,
        revenueFromDelivered,
        revenueFromCompleted,
        revenueFromAll,
        allOrders: allOrders.map(order => ({
          _id: order._id,
          status: order.status,
          total: order.total,
          totalAmount: order.totalAmount,
          finalTotal: order.finalTotal,
          createdAt: order.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('❌ Debug revenue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;