const express = require('express');
const User = require('../models/User');
const Product = require('../models/Product');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Voucher = require('../models/Voucher');
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

// Admin dashboard stats - SIMPLIFIED VERSION
router.get('/admin', adminAuth, async (req, res) => {
  try {
    console.log('Loading admin dashboard...');
    
    // Use Promise.all for parallel queries
    const [
      users,
      products,
      services,
      bookings,
      orders,
      vouchers
    ] = await Promise.all([
      User.find(),
      Product.find(),
      Service.find(),
      Booking.find().populate('user', 'name email').populate('service', 'name'),
      Order.find().populate('user', 'name email').populate('items.product', 'name price'),
      Voucher.find().populate('assignedTo', 'name email')
    ]);

    // Calculate stats from the data we already fetched
    const totalUsers = users.length;
    const totalProducts = products.length;
    const totalServices = services.length;
    const totalBookings = bookings.length;
    const totalOrders = orders.length;
    
    // Calculate total revenue
    const totalRevenue = orders.reduce((sum, order) => sum + (order.finalTotal || order.total || 0), 0);

    // Get recent activity (last 5 items)
    const recentBookings = bookings
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const recentOrders = orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    // Staff performance (simplified)
    const staffUsers = users.filter(user => user.role === 'staff');
    const staffPerformance = await Promise.all(
      staffUsers.map(async (staff) => {
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
      })
    );

    // Popular services (simplified)
    const serviceCounts = {};
    bookings.forEach(booking => {
      if (booking.service && booking.service.name) {
        serviceCounts[booking.service.name] = (serviceCounts[booking.service.name] || 0) + 1;
      }
    });
    
    const popularServices = Object.entries(serviceCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Monthly revenue (simplified - last 6 months)
    const monthlyRevenue = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() === month.getMonth() && 
               orderDate.getFullYear() === month.getFullYear();
      });
      
      const revenue = monthOrders.reduce((sum, order) => sum + (order.finalTotal || order.total || 0), 0);
      
      monthlyRevenue.push({
        _id: month.getMonth() + 1,
        revenue: revenue,
        monthName: month.toLocaleString('default', { month: 'short' })
      });
    }
    
    monthlyRevenue.reverse(); // Show oldest to newest

    res.json({
      stats: {
        totalUsers,
        totalProducts,
        totalServices,
        totalBookings,
        totalOrders,
        totalRevenue
      },
      monthlyRevenue,
      recentBookings,
      recentOrders,
      staffPerformance,
      popularServices
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ 
      message: 'Server error loading dashboard', 
      error: error.message 
    });
  }
});

// Staff dashboard stats - SIMPLIFIED VERSION
router.get('/staff', staffAuth, async (req, res) => {
  try {
    console.log('Loading staff dashboard for:', req.user.name);
    
    // Get all data first
    const [allBookings, allOrders, vouchers] = await Promise.all([
      Booking.find().populate('user', 'name email phone').populate('service', 'name price duration'),
      Order.find().populate('user', 'name email').populate('items.product', 'name price'),
      Voucher.find({ assignedTo: req.user._id })
    ]);

    // Filter for current staff member
    const staffBookings = allBookings.filter(booking => 
      booking.staff && booking.staff.toString() === req.user._id.toString()
    );

    // Calculate stats
    const totalSales = staffBookings.length;
    
    // Unique clients
    const uniqueClients = [...new Set(staffBookings.map(booking => booking.user?._id?.toString()))].filter(Boolean);
    const totalClients = uniqueClients.length;

    // Calculate total hours worked
    let totalHours = 0;
    staffBookings.forEach(booking => {
      if (booking.duration) {
        const durationMatch = booking.duration.match(/(\d+)/);
        if (durationMatch) {
          totalHours += parseInt(durationMatch[1]) / 60; // Convert minutes to hours
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

    // Recent sales (show all orders for now, or filter by staff if you have that data)
    const recentSales = allOrders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    res.json({
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
    console.error('Staff dashboard error:', error);
    res.status(500).json({ 
      message: 'Server error loading staff dashboard', 
      error: error.message 
    });
  }
});

module.exports = router;