const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Voucher = require('../models/Voucher');
const GiftOrder = require('../models/GiftOrder');
const { auth, adminAuth, staffAuth } = require('../middleware/auth');
const cacheMiddleware = require('../middleware/cache');

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

// Admin dashboard stats - FIXED VERSION WITH ADMIN IN PERFORMANCE
router.get('/admin', adminAuth, async (req, res) => {
  try {
    console.log('📊 Loading admin dashboard for:', req.user.name);

    // Use Promise.allSettled to handle individual failures
    const results = await Promise.allSettled([
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

    // Handle individual promise results
    const [
      usersResult,
      productsResult,
      servicesResult,
      allBookingsResult,
      allOrdersResult,
      allGiftOrdersResult,
      vouchersResult
    ] = results;

    // Extract data with fallbacks
    const users = usersResult.status === 'fulfilled' ? usersResult.value : [];
    const products = productsResult.status === 'fulfilled' ? productsResult.value : [];
    const services = servicesResult.status === 'fulfilled' ? servicesResult.value : [];
    const allBookings = allBookingsResult.status === 'fulfilled' ? allBookingsResult.value : [];
    const allOrders = allOrdersResult.status === 'fulfilled' ? allOrdersResult.value : [];
    const allGiftOrders = allGiftOrdersResult.status === 'fulfilled' ? allGiftOrdersResult.value : [];
    const vouchers = vouchersResult.status === 'fulfilled' ? vouchersResult.value : [];

    console.log('📊 Data loaded successfully:', {
      users: users.length,
      products: products.length,
      services: services.length,
      bookings: allBookings.length,
      orders: allOrders.length,
      giftOrders: allGiftOrders.length,
      vouchers: vouchers.length
    });

    // SAFE data filtering with null checks
    const revenueOrders = (allOrders || []).filter(order =>
      order && (order.status === 'paid' || order.status === 'pending' || order.status === 'delivered' || order.status === 'completed')
    );

    const revenueBookings = (allBookings || []).filter(booking =>
      booking && (booking.status === 'completed' || booking.status === 'confirmed')
    );

    const revenueGiftOrders = (allGiftOrders || []).filter(giftOrder =>
      giftOrder && (giftOrder.status === 'completed' || giftOrder.status === 'delivered' || giftOrder.status === 'paid')
    );

    console.log('✅ Filtered revenue data:', {
      revenueOrders: revenueOrders.length,
      revenueBookings: revenueBookings.length,
      revenueGiftOrders: revenueGiftOrders.length
    });

    // Calculate stats with safe defaults
    const totalUsers = users.length || 0;
    const totalProducts = products.length || 0;
    const totalServices = services.length || 0;
    const totalBookings = allBookings.length || 0;
    const totalOrders = allOrders.length || 0;
    const totalGiftOrders = allGiftOrders.length || 0;

    // Calculate total revenue with safe defaults
    const ordersRevenue = (revenueOrders || []).reduce((sum, order) => {
      const orderTotal = order?.finalTotal || order?.total || order?.totalAmount || 0;
      return sum + (Number(orderTotal) || 0);
    }, 0);

    const bookingsRevenue = (revenueBookings || []).reduce((sum, booking) => {
      const bookingPrice = booking?.service?.price || booking?.price || 0;
      return sum + (Number(bookingPrice) || 0);
    }, 0);

    const giftOrdersRevenue = (revenueGiftOrders || []).reduce((sum, giftOrder) => {
      const giftPrice = giftOrder?.price || giftOrder?.total || giftOrder?.giftPackage?.basePrice || 0;
      return sum + (Number(giftPrice) || 0);
    }, 0);

    const totalRevenue = ordersRevenue + bookingsRevenue + giftOrdersRevenue;

    console.log('💰 Revenue Breakdown:', {
      orders: ordersRevenue,
      bookings: bookingsRevenue,
      giftOrders: giftOrdersRevenue,
      total: totalRevenue
    });

    // Monthly revenue calculation with safe data
    const monthlyRevenue = calculateMonthlyRevenue(revenueOrders, revenueBookings, revenueGiftOrders);
    console.log('📈 Monthly Revenue Data:', monthlyRevenue);

    // Get recent activity and include user login events
    let recentActivity = getRecentActivity(allBookings, allOrders, allGiftOrders);
    try {
      const userLoginActivities = mapUserLoginsToActivities(users);
      // Merge and sort by timestamp
      recentActivity = [
        ...recentActivity,
        ...userLoginActivities
      ].sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date)).slice(0, 10);
    } catch (err) {
      console.warn('Could not include user login activities in admin recentActivity:', err?.message || err);
    }

    // Staff performance - NOW INCLUDES ADMIN
    const staffUsers = (users || []).filter(user => user.role === 'staff' || user.role === 'admin');
    const staffPerformance = calculateStaffPerformance(allBookings, allOrders, allGiftOrders, staffUsers);

    // Popular services
    const popularServices = calculatePopularServices(allBookings);

    // Send response
    res.json({
      success: true,
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
      recentActivity,
      staffPerformance,
      popularServices
    });

  } catch (error) {
    console.error('❌ Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error loading dashboard',
      error: error.message,
      // Provide basic fallback data
      fallback: {
        stats: {
          totalUsers: 0,
          totalProducts: 0,
          totalServices: 0,
          totalBookings: 0,
          totalOrders: 0,
          totalGiftOrders: 0,
          totalRevenue: 0
        },
        monthlyRevenue: {},
        recentActivity: [],
        staffPerformance: [],
        popularServices: []
      }
    });
  }
});

// Advanced revenue analytics
router.get('/analytics/revenue-trends', adminAuth, async (req, res) => {
  try {
    const { period = 'monthly' } = req.query; // monthly, weekly, daily

    const revenueData = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'completed',
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          revenue: { $sum: "$finalTotal" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, revenueData });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ success: false, message: 'Error fetching revenue analytics' });
  }
});

// Staff dashboard - UPDATED WITH BETTER DATA
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

    // Recent sales from all sources - FIXED TYPE MAPPING
    const recentSales = [
      ...staffOrders.map(order => ({
        type: 'order', // Changed from 'product' to 'order' for receipt compatibility
        description: `Sold ${order.items?.length || 0} products to ${order.user?.name || 'Customer'}`,
        amount: order.finalTotal || order.total || 0,
        date: order.createdAt,
        id: order._id,
        customer: order.user?.name || 'Customer'
      })),
      ...staffBookings.map(booking => ({
        type: 'booking',
        description: `Booked ${booking.service?.name || 'Service'} for ${booking.user?.name || 'Customer'}`,
        amount: booking.service?.price || booking.price || 0,
        date: booking.createdAt,
        id: booking._id,
        customer: booking.user?.name || 'Customer'
      })),
      ...staffGiftOrders.map(giftOrder => ({
        type: 'gift',
        description: `Gift package for ${giftOrder.recipientName}`,
        amount: giftOrder.price || giftOrder.total || giftOrder.giftPackage?.basePrice || 0,
        date: giftOrder.createdAt,
        id: giftOrder._id,
        customer: giftOrder.user?.name || 'Customer'
      }))
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    // Provide detailed data for the frontend
    const detailedData = {
      bookings: staffBookings.map(b => ({
        _id: b._id,
        type: 'booking',
        createdAt: b.createdAt,
        user: b.user,
        service: b.service,
        amount: b.service?.price || b.price || 0,
        status: b.status
      })),
      orders: staffOrders.map(o => ({
        _id: o._id,
        type: 'order',
        createdAt: o.createdAt,
        user: o.user,
        items: o.items,
        amount: o.finalTotal || o.total || 0,
        status: o.status
      })),
      giftOrders: staffGiftOrders.map(g => ({
        _id: g._id,
        type: 'gift',
        createdAt: g.createdAt,
        user: g.user,
        giftPackage: g.giftPackage,
        amount: g.price || g.total || g.giftPackage?.basePrice || 0,
        status: g.status
      }))
    };

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
      detailedData // Send detailed data for frontend use
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

// Get printable receipt data - UPDATED WITH PRODUCT SUPPORT
router.get('/receipt/:type/:id', auth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    console.log(`📄 Generating receipt for ${type} with ID: ${id}`);

    let receiptData = null;

    // Map 'product' type to 'order' since products are sold through orders
    const receiptType = type === 'product' ? 'order' : type;

    switch (receiptType) {
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
        return res.status(400).json({
          success: false,
          message: `Invalid receipt type: ${type}. Supported types: booking, order, product, gift`
        });
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

// Add these routes to your existing dashboard.js file

// Customer dashboard routes
router.get('/orders/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name price')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/bookings/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('service', 'name price duration')
      .populate('staff', 'name')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/gift-orders/my-gifts', auth, async (req, res) => {
  try {
    const gifts = await GiftOrder.find({ user: req.user._id })
      .populate('giftPackage', 'name basePrice')
      .populate('assignedStaff', 'name')
      .sort({ createdAt: -1 });
    res.json(gifts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User search endpoint
router.get('/users/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    const currentUser = req.user;
    const regex = { $regex: q, $options: 'i' };

    // Admins can search across all users
    if (currentUser.role === 'admin') {
      const users = await User.find({
        $or: [
          { name: regex },
          { email: regex }
        ]
      }).select('name email phone role');
      return res.json({ users });
    }

    // Staff: limit search to customers linked to this staff via bookings/orders/gift-orders,
    // but allow finding staff/admin accounts as well (so staff can look up colleagues)
    if (currentUser.role === 'staff') {
      const [bookings, orders, gifts] = await Promise.all([
        Booking.find({ $or: [{ staff: currentUser._id }, { assignedStaff: currentUser._id }] }).select('user').lean(),
        Order.find({ $or: [{ processedBy: currentUser._id }, { assignedStaff: currentUser._id }] }).select('user').lean(),
        GiftOrder.find({ assignedStaff: currentUser._id }).select('user').lean()
      ]);

      const userIdSet = new Set();
      bookings.forEach(b => { if (b && b.user) userIdSet.add(b.user.toString()); });
      orders.forEach(o => { if (o && o.user) userIdSet.add(o.user.toString()); });
      gifts.forEach(g => { if (g && g.user) userIdSet.add(g.user.toString()); });

      const orClauses = [ { role: { $in: ['staff', 'admin'] } } ];
      if (userIdSet.size > 0) orClauses.push({ _id: { $in: Array.from(userIdSet) } });

      const users = await User.find({
        $and: [
          { $or: [{ name: regex }, { email: regex }] },
          { $or: orClauses }
        ]
      }).select('name email phone role');

      return res.json({ users });
    }

    // Customers: only allow searching for themselves (by name/email)
    const users = await User.find({
      _id: currentUser._id,
      $or: [ { name: regex }, { email: regex } ]
    }).select('name email phone role');

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// Add these routes to your existing routes

// Status update routes
router.patch('/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({ success: false, message: 'Error updating order status' });
  }
});

router.patch('/bookings/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, booking });
  } catch (error) {
    console.error('Booking status update error:', error);
    res.status(500).json({ success: false, message: 'Error updating booking status' });
  }
});

router.patch('/gift-orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const giftOrder = await GiftOrder.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!giftOrder) {
      return res.status(404).json({ success: false, message: 'Gift order not found' });
    }

    res.json({ success: true, giftOrder });
  } catch (error) {
    console.error('Gift order status update error:', error);
    res.status(500).json({ success: false, message: 'Error updating gift order status' });
  }
});

// Data fetching routes for admin management
router.get('/orders', adminAuth, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('items.product', 'name price')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, orders });
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Error fetching orders' });
  }
});

router.get('/bookings', adminAuth, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user', 'name email')
      .populate('service', 'name price')
      .populate('staff', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, bookings });
  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({ success: false, message: 'Error fetching bookings' });
  }
});

router.get('/gift-orders', adminAuth, async (req, res) => {
  try {
    const giftOrders = await GiftOrder.find()
      .populate('user', 'name email')
      .populate('giftPackage', 'name basePrice')
      .populate('assignedStaff', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, giftOrders });
  } catch (error) {
    console.error('Gift orders fetch error:', error);
    res.status(500).json({ success: false, message: 'Error fetching gift orders' });
  }
});

// UPDATED Helper functions
// UPDATED: Monthly revenue with better error handling
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
  (orders || []).forEach(order => {
    if (!order || !order.createdAt) return;

    try {
      const orderDate = new Date(order.createdAt);
      const monthKey = orderDate.toLocaleString('default', { month: 'short' }) + ' ' + orderDate.getFullYear();
      if (monthlyRevenue[monthKey] !== undefined) {
        const amount = order.finalTotal || order.total || order.totalAmount || 0;
        monthlyRevenue[monthKey] += Number(amount) || 0;
      }
    } catch (error) {
      console.error('Error processing order date:', error);
    }
  });

  // Add revenue from bookings
  (bookings || []).forEach(booking => {
    if (!booking || !booking.createdAt) return;

    try {
      const bookingDate = new Date(booking.createdAt);
      const monthKey = bookingDate.toLocaleString('default', { month: 'short' }) + ' ' + bookingDate.getFullYear();
      if (monthlyRevenue[monthKey] !== undefined) {
        const amount = booking.service?.price || booking.price || 0;
        monthlyRevenue[monthKey] += Number(amount) || 0;
      }
    } catch (error) {
      console.error('Error processing booking date:', error);
    }
  });

  // Add revenue from gift orders
  (giftOrders || []).forEach(giftOrder => {
    if (!giftOrder || !giftOrder.createdAt) return;

    try {
      const giftOrderDate = new Date(giftOrder.createdAt);
      const monthKey = giftOrderDate.toLocaleString('default', { month: 'short' }) + ' ' + giftOrderDate.getFullYear();
      if (monthlyRevenue[monthKey] !== undefined) {
        const amount = giftOrder.price || giftOrder.total || giftOrder.giftPackage?.basePrice || 0;
        monthlyRevenue[monthKey] += Number(amount) || 0;
      }
    } catch (error) {
      console.error('Error processing gift order date:', error);
    }
  });

  console.log('📈 Final monthly revenue:', monthlyRevenue);
  return monthlyRevenue;
}

// UPDATED: Staff performance with better error handling
// FIXED: Staff performance with consistent revenue filtering
function calculateStaffPerformance(bookings, orders, giftOrders, staffUsers) {
  if (!staffUsers || !Array.isArray(staffUsers)) {
    return [];
  }

  // Use the same filtering logic as total revenue calculation
  const revenueBookings = (bookings || []).filter(booking =>
    booking && (booking.status === 'completed' || booking.status === 'confirmed')
  );

  const revenueOrders = (orders || []).filter(order =>
    order && (order.status === 'paid' || order.status === 'pending' || order.status === 'delivered' || order.status === 'completed')
  );

  const revenueGiftOrders = (giftOrders || []).filter(giftOrder =>
    giftOrder && (giftOrder.status === 'completed' || giftOrder.status === 'delivered' || giftOrder.status === 'paid')
  );

  return staffUsers.map(staff => {
    if (!staff || !staff._id) return null;

    // Filter staff activities using the SAME revenue criteria
    const staffBookings = revenueBookings.filter(booking =>
      booking && booking.staff && booking.staff._id && booking.staff._id.toString() === staff._id.toString()
    );

    const staffOrders = revenueOrders.filter(order =>
      order && order.processedBy && order.processedBy._id && order.processedBy._id.toString() === staff._id.toString()
    );

    const staffGiftOrders = revenueGiftOrders.filter(giftOrder =>
      giftOrder && giftOrder.assignedStaff && giftOrder.assignedStaff._id && giftOrder.assignedStaff._id.toString() === staff._id.toString()
    );

    // Calculate revenue with the same logic as total revenue
    const bookingRevenue = staffBookings.reduce((sum, booking) => {
      const price = booking?.service?.price || booking?.price || 0;
      return sum + (Number(price) || 0);
    }, 0);

    const orderRevenue = staffOrders.reduce((sum, order) => {
      const total = order?.finalTotal || order?.total || order?.totalAmount || 0;
      return sum + (Number(total) || 0);
    }, 0);

    const giftRevenue = staffGiftOrders.reduce((sum, giftOrder) => {
      const price = giftOrder?.price || giftOrder?.total || giftOrder?.giftPackage?.basePrice || 0;
      return sum + (Number(price) || 0);
    }, 0);

    const totalRevenue = bookingRevenue + orderRevenue + giftRevenue;
    const totalActivities = staffBookings.length + staffOrders.length + staffGiftOrders.length;

    console.log(`💰 Staff ${staff.name} (${staff.role}):`, {
      bookings: { count: staffBookings.length, revenue: bookingRevenue },
      orders: { count: staffOrders.length, revenue: orderRevenue },
      gifts: { count: staffGiftOrders.length, revenue: giftRevenue },
      totalRevenue: totalRevenue
    });

    return {
      _id: staff._id,
      name: staff.name || 'Unknown Staff',
      email: staff.email || '',
      role: staff.role || 'staff',
      totalBookings: staffBookings.length,
      totalOrders: staffOrders.length,
      totalGiftOrders: staffGiftOrders.length,
      totalActivities: totalActivities,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      breakdown: {
        bookings: Math.round(bookingRevenue * 100) / 100,
        orders: Math.round(orderRevenue * 100) / 100,
        gifts: Math.round(giftRevenue * 100) / 100
      },
      isAdmin: staff.role === 'admin'
    };
  })
    .filter(staff => staff !== null)
    .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
}

// Helper function to calculate performance score
function calculatePerformanceScore(revenue, activities, role) {
  if (activities === 0) return 0;

  const revenuePerActivity = revenue / activities;
  let score = (revenuePerActivity / 1000) * 100; // Base score on R1000 per activity

  // Adjust for role - admins might have different performance expectations
  if (role === 'admin') {
    score = score * 1.2; // Admins get 20% bonus for oversight role
  }

  return Math.min(Math.round(score), 100); // Cap at 100
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

// Include login events from users as activities (helper)
function mapUserLoginsToActivities(users) {
  if (!Array.isArray(users)) return [];
  return users
    .filter(u => u && u.lastLogin)
    .map(u => ({
      type: 'login',
      id: `login_${u._id}`,
      title: `User Login: ${u.name}`,
      description: `${u.name} logged in`,
      timestamp: u.lastLogin,
      user: { _id: u._id, name: u.name, email: u.email, role: u.role }
    }));
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

// GET /dashboard/staff/activities
router.get('/staff/activities', staffAuth, async (req, res) => {
  try {
    // For a staff user: Fetch their related bookings, orders, gifts.
    const userId = req.user._id;

    const [bookings, orders, giftOrders] = await Promise.all([
      Booking.find({ staff: userId })
        .populate('user', 'name email')
        .populate('service', 'name price')
        .lean(),
      Order.find({ processedBy: userId })
        .populate('user', 'name email')
        .lean(),
      GiftOrder.find({ assignedStaff: userId })
        .populate('user', 'name email')
        .populate('giftPackage', 'name basePrice')
        .lean()
    ]);

    // Combine activities into a single list with types
    const activities = [
      ...bookings.map(b => ({
        _id: b._id,
        type: 'booking',
        id: b._id,
        user: b.user || null,
        service: b.service || null,
        amount: b.service?.price || b.price || 0,
        description: `Booking - ${b.service?.name || 'Service'}`,
        date: b.createdAt,
        status: b.status,
      })),
      ...orders.map(o => ({
        _id: o._id,
        type: 'order',
        id: o._id,
        user: o.user || null,
        items: o.items || [],
        amount: o.finalTotal || o.total || 0,
        description: `Order #${o._id?.toString().slice(-6)}`,
        date: o.createdAt,
        status: o.status,
      })),
      ...giftOrders.map(g => ({
        _id: g._id,
        type: 'gift',
        id: g._id,
        user: g.user || null,
        giftPackage: g.giftPackage || null,
        amount: g.price || g.total || g.giftPackage?.basePrice || 0,
        description: `Gift - ${g.giftPackage?.name || 'Package'}`,
        date: g.createdAt,
        status: g.status,
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)); // descending by date

    // Also include recent customer login events (helpful for staff to see customer engagement)
    try {
      const customers = await User.find({ role: 'customer' }).select('name email lastLogin').lean();
      const loginActivities = mapUserLoginsToActivities(customers).map(a => ({
        ...a,
        date: a.timestamp
      }));

      const merged = [...activities, ...loginActivities]
        .sort((a, b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp))
        .slice(0, 20);

      res.json({ success: true, activities: merged });
    } catch (err) {
      console.warn('Could not fetch customer login activities for staff view:', err?.message || err);
      res.json({ success: true, activities });
    }

  } catch (error) {
    console.error('❌ Staff activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading staff activities',
      error: error.message
    });
  }
});

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