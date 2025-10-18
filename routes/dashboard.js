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

// Admin dashboard stats - UPDATED to include admin in performance
router.get('/admin', adminAuth, async (req, res) => {
  try {
    console.log('📊 Loading admin dashboard for:', req.user.name);

    // Use Promise.all for parallel queries
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
      Order.find()
        .populate('user', 'name email')
        .populate('items.product', 'name price')
        .populate('processedBy', 'name email')
        .lean(),
      GiftOrder.find()
        .populate('giftPackage', 'basePrice')
        .populate('assignedStaff', 'name email')
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

    // Filter revenue data
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

    // Calculate total revenue
    const ordersRevenue = revenueOrders.reduce((sum, order) => {
      const orderTotal = order.finalTotal || order.total || order.totalAmount || 0;
      return sum + orderTotal;
    }, 0);
    
    const bookingsRevenue = revenueBookings.reduce((sum, booking) => {
      const bookingPrice = booking.price || 0;
      return sum + bookingPrice;
    }, 0);
    
    const giftOrdersRevenue = revenueGiftOrders.reduce((sum, giftOrder) => {
      const giftPrice = giftOrder.price || giftOrder.total || 0;
      return sum + giftPrice;
    }, 0);
    
    const totalRevenue = ordersRevenue + bookingsRevenue + giftOrdersRevenue;

    console.log('💰 Revenue Breakdown:', {
      orders: ordersRevenue,
      bookings: bookingsRevenue,
      giftOrders: giftOrdersRevenue,
      total: totalRevenue
    });

    // Monthly revenue calculation
    const monthlyRevenue = calculateMonthlyRevenue(revenueOrders, revenueBookings, revenueGiftOrders);
    console.log('📈 Monthly Revenue Data:', monthlyRevenue);

    // Get recent activity - include all for display
    const recentActivity = getRecentActivity(allBookings, allOrders, allGiftOrders);

    // Staff performance - NOW INCLUDES ADMIN
    const staffUsers = users.filter(user => user.role === 'staff' || user.role === 'admin');
    const staffPerformance = calculateStaffPerformance(allBookings, allOrders, allGiftOrders, staffUsers);

    // Popular services
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
      recentActivity, // Changed from separate recentBookings/recentOrders
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

// Staff dashboard - UPDATED
router.get('/staff', staffAuth, async (req, res) => {
  try {
    console.log('👨‍💼 Loading staff dashboard for:', req.user.name);

    // Get all data first
    const [allBookings, allOrders, allGiftOrders, vouchers] = await Promise.all([
      Booking.find()
        .populate('user', 'name email phone')
        .populate('service', 'name price duration')
        .populate('staff', 'name email')
        .lean(),
      Order.find()
        .populate('user', 'name email')
        .populate('items.product', 'name price')
        .populate('processedBy', 'name email')
        .lean(),
      GiftOrder.find()
        .populate('user', 'name email')
        .populate('giftPackage', 'name basePrice')
        .populate('assignedStaff', 'name email')
        .lean(),
      Voucher.find({ assignedTo: req.user._id }).lean()
    ]);

    // Filter for current staff member across all revenue sources
    const staffBookings = allBookings.filter(booking =>
      booking.staff && booking.staff._id && booking.staff._id.toString() === req.user._id.toString()
    );

    const staffOrders = allOrders.filter(order =>
      order.processedBy && order.processedBy._id && order.processedBy._id.toString() === req.user._id.toString()
    );

    const staffGiftOrders = allGiftOrders.filter(giftOrder =>
      giftOrder.assignedStaff && giftOrder.assignedStaff._id && giftOrder.assignedStaff._id.toString() === req.user._id.toString()
    );

    // Calculate stats
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
      if (booking.service && booking.service.duration) {
        const durationMatch = booking.service.duration.match(/(\d+)/);
        if (durationMatch) {
          totalHours += parseInt(durationMatch[1]) / 60;
        }
      }
    });

    // Calculate commission (15% of total value from all sources)
    const bookingCommission = staffBookings.reduce((sum, booking) => sum + ((booking.service?.price || booking.price || 0) * 0.15), 0);
    const orderCommission = staffOrders.reduce((sum, order) => sum + ((order.finalTotal || order.total || 0) * 0.15), 0);
    const giftCommission = staffGiftOrders.reduce((sum, giftOrder) => sum + ((giftOrder.price || giftOrder.total || giftOrder.giftPackage?.basePrice || 0) * 0.15), 0);
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
        description: `Sold ${order.items?.length || 0} products`,
        amount: order.finalTotal || order.total || 0,
        date: order.createdAt,
        id: order._id
      })),
      ...staffBookings.map(booking => ({
        type: 'service',
        description: `Booked ${booking.service?.name || 'Service'}`,
        amount: booking.service?.price || booking.price || 0,
        date: booking.createdAt,
        id: booking._id
      })),
      ...staffGiftOrders.map(giftOrder => ({
        type: 'gift',
        description: `Sold gift package`,
        amount: giftOrder.price || giftOrder.total || giftOrder.giftPackage?.basePrice || 0,
        date: giftOrder.createdAt,
        id: giftOrder._id
      }))
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    res.json({
      success: true,
      stats: {
        totalSales,
        totalClients,
        totalHours: Math.round(totalHours * 10) / 10, // 1 decimal place
        totalCommission: Math.round(totalCommission * 100) / 100, // 2 decimal places
        revenueBreakdown: {
          bookings: staffBookings.length,
          orders: staffOrders.length,
          giftOrders: staffGiftOrders.length
        }
      },
      upcomingAppointments,
      recentSales,
      myVouchers: vouchers,
      // Add detailed data for receipts
      detailedData: {
        bookings: staffBookings,
        orders: staffOrders,
        giftOrders: staffGiftOrders
      }
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

// NEW: Get printable receipt data
// Get printable receipt data - CORRECTED VERSION
router.get('/receipt/:type/:id', auth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    console.log(`📄 Generating receipt for ${type} with ID: ${id}`);

    let receiptData = null;

    switch (type) {
      case 'booking':
        const booking = await Booking.findById(id)
          .populate('user', 'name email phone')
          .populate('service', 'name price duration')
          .populate('staff', 'name email');
        
        if (!booking) {
          return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Check if user has permission to view this receipt
        if (userRole === 'customer' && booking.user._id.toString() !== userId.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
        if (userRole === 'staff' && booking.staff && booking.staff._id.toString() !== userId.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }

        receiptData = {
          type: 'booking',
          id: booking._id,
          date: booking.createdAt,
          customer: booking.user.name,
          customerEmail: booking.user.email,
          customerPhone: booking.user.phone,
          service: booking.service.name,
          staff: booking.staff ? booking.staff.name : 'Not assigned',
          amount: booking.service.price,
          duration: booking.service.duration,
          bookingDate: booking.date,
          bookingTime: booking.time,
          status: booking.status,
          specialRequests: booking.specialRequests || 'None'
        };
        break;

      case 'order':
        const order = await Order.findById(id)
          .populate('user', 'name email phone')
          .populate('items.product', 'name price')
          .populate('processedBy', 'name email');

        if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (userRole === 'customer' && order.user._id.toString() !== userId.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
        if (userRole === 'staff' && order.processedBy && order.processedBy._id.toString() !== userId.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }

        receiptData = {
          type: 'order',
          id: order._id,
          date: order.createdAt,
          customer: order.user.name,
          customerEmail: order.user.email,
          customerPhone: order.user.phone,
          items: order.items.map(item => ({
            product: item.product.name,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.quantity * item.price
          })),
          total: order.finalTotal || order.total || order.totalAmount || 0,
          processedBy: order.processedBy?.name || 'System',
          status: order.status,
          shippingAddress: order.shippingAddress || 'Not specified'
        };
        break;

      case 'gift':
        const giftOrder = await GiftOrder.findById(id)
          .populate('user', 'name email phone')
          .populate('giftPackage', 'name basePrice')
          .populate('assignedStaff', 'name email');

        if (!giftOrder) {
          return res.status(404).json({ success: false, message: 'Gift order not found' });
        }

        if (userRole === 'customer' && giftOrder.user._id.toString() !== userId.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
        if (userRole === 'staff' && giftOrder.assignedStaff && giftOrder.assignedStaff._id.toString() !== userId.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }

        receiptData = {
          type: 'gift',
          id: giftOrder._id,
          date: giftOrder.createdAt,
          customer: giftOrder.user.name,
          customerEmail: giftOrder.user.email,
          customerPhone: giftOrder.user.phone,
          recipient: giftOrder.recipientName,
          recipientEmail: giftOrder.recipientEmail,
          giftPackage: giftOrder.giftPackage.name,
          amount: giftOrder.price || giftOrder.total || giftOrder.giftPackage.basePrice,
          message: giftOrder.message,
          assignedStaff: giftOrder.assignedStaff?.name || 'Not assigned',
          deliveryDate: giftOrder.deliveryDate,
          status: giftOrder.status
        };
        break;

      default:
        return res.status(400).json({ success: false, message: 'Invalid receipt type' });
    }

    console.log('✅ Receipt data generated successfully');

    res.json({
      success: true,
      receipt: receiptData,
      company: {
        name: 'Tassel Group',
        email: 'info@tasselgroup.co.za',
        phone: '+27123456789',
        address: '123 Beauty Street, Johannesburg, South Africa',
        vatNumber: 'VAT123456789',
        registration: 'Reg: 2023/123456/07'
      }
    });

  } catch (error) {
    console.error('❌ Receipt error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating receipt',
      error: error.message
    });
  }
});

// NEW: Get user activity for receipts (admin/staff can view their users' activities)
router.get('/user-activity/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    // Check permissions
    if (currentUser.role === 'customer' && currentUser._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [bookings, orders, giftOrders] = await Promise.all([
      Booking.find({ user: userId })
        .populate('service', 'name price')
        .populate('staff', 'name')
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({ user: userId })
        .populate('items.product', 'name price')
        .populate('processedBy', 'name')
        .sort({ createdAt: -1 })
        .lean(),
      GiftOrder.find({ user: userId })
        .populate('giftPackage', 'name basePrice')
        .populate('assignedStaff', 'name')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    res.json({
      success: true,
      userActivity: {
        bookings,
        orders,
        giftOrders
      }
    });

  } catch (error) {
    console.error('❌ User activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user activity',
      error: error.message
    });
  }
});

// UPDATED Helper functions
function calculateMonthlyRevenue(orders, bookings, giftOrders) {
  const monthlyRevenue = {};
  const now = new Date();

  // Create last 6 months
  for (let i = 0; i < 6; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = month.toLocaleString('default', { month: 'short' }) + ' ' + month.getFullYear();
    monthlyRevenue[monthKey] = 0;
  }

  // Add revenue from orders
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
      monthlyRevenue[monthKey] += booking.service?.price || booking.price || 0;
    }
  });

  // Add revenue from gift orders
  giftOrders.forEach(giftOrder => {
    const giftOrderDate = new Date(giftOrder.createdAt);
    const monthKey = giftOrderDate.toLocaleString('default', { month: 'short' }) + ' ' + giftOrderDate.getFullYear();
    if (monthlyRevenue[monthKey] !== undefined) {
      monthlyRevenue[monthKey] += giftOrder.price || giftOrder.total || giftOrder.giftPackage?.basePrice || 0;
    }
  });

  console.log('📈 Final monthly revenue:', monthlyRevenue);
  return monthlyRevenue;
}

// UPDATED: Staff performance now includes admin
function calculateStaffPerformance(bookings, orders, giftOrders, staffUsers) {
  return staffUsers.map(staff => {
    const staffBookings = bookings.filter(booking => 
      booking.staff && booking.staff._id && booking.staff._id.toString() === staff._id.toString()
    );
    
    const staffOrders = orders.filter(order =>
      order.processedBy && order.processedBy._id && order.processedBy._id.toString() === staff._id.toString()
    );
    
    const staffGiftOrders = giftOrders.filter(giftOrder =>
      giftOrder.assignedStaff && giftOrder.assignedStaff._id && giftOrder.assignedStaff._id.toString() === staff._id.toString()
    );

    const bookingRevenue = staffBookings.reduce((sum, booking) => sum + (booking.service?.price || booking.price || 0), 0);
    const orderRevenue = staffOrders.reduce((sum, order) => sum + (order.finalTotal || order.total || order.totalAmount || 0), 0);
    const giftRevenue = staffGiftOrders.reduce((sum, giftOrder) => sum + (giftOrder.price || giftOrder.total || giftOrder.giftPackage?.basePrice || 0), 0);
    
    const totalRevenue = bookingRevenue + orderRevenue + giftRevenue;
    const totalActivities = staffBookings.length + staffOrders.length + staffGiftOrders.length;
    
    return {
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      totalBookings: staffBookings.length,
      totalOrders: staffOrders.length,
      totalGiftOrders: staffGiftOrders.length,
      totalActivities: totalActivities,
      totalRevenue: totalRevenue,
      breakdown: {
        bookings: bookingRevenue,
        orders: orderRevenue,
        gifts: giftRevenue
      }
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// NEW: Get recent activity combining all types
function getRecentActivity(bookings, orders, giftOrders) {
  const allActivities = [
    ...bookings.map(booking => ({
      type: 'booking',
      id: booking._id,
      title: `New Booking: ${booking.service?.name || 'Service'}`,
      description: `Booked by ${booking.user?.name || 'Customer'}`,
      amount: booking.service?.price || booking.price || 0,
      timestamp: booking.createdAt,
      status: booking.status,
      user: booking.user
    })),
    ...orders.map(order => ({
      type: 'order',
      id: order._id,
      title: `New Order: ${order.items?.length || 0} items`,
      description: `Order by ${order.user?.name || 'Customer'}`,
      amount: order.finalTotal || order.total || 0,
      timestamp: order.createdAt,
      status: order.status,
      user: order.user
    })),
    ...giftOrders.map(giftOrder => ({
      type: 'gift',
      id: giftOrder._id,
      title: `Gift Order: ${giftOrder.giftPackage?.name || 'Gift Package'}`,
      description: `Gift for ${giftOrder.recipientName}`,
      amount: giftOrder.price || giftOrder.total || giftOrder.giftPackage?.basePrice || 0,
      timestamp: giftOrder.createdAt,
      status: giftOrder.status,
      user: giftOrder.user
    }))
  ];

  return allActivities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);
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

// Keep your existing public-stats and debug routes...
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

// Debug route (keep your existing)
router.get('/admin/debug-revenue', adminAuth, async (req, res) => {
  // ... keep your existing debug code
});

module.exports = router;