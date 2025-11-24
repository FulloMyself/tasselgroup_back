const express = require('express');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { auth, staffAuth, adminAuth } = require('../middleware/auth');
const cacheMiddleware = require('../middleware/cache');
const nodemailer = require('nodemailer');

const router = express.Router();

// Email configuration (add this if not present)
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Create booking
router.post('/', cacheMiddleware(300), auth, async (req, res) => {
  try {
    console.log('📝 Booking creation request received:', {
      user: req.user._id,
      body: req.body
    });

    const { service, staff, date, time, specialRequests } = req.body;

    // Validate required fields
    if (!service) {
      return res.status(400).json({ message: 'Service ID is required' });
    }
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    if (!time) {
      return res.status(400).json({ message: 'Time is required' });
    }

    // Find the service to get price and duration
    console.log('🔍 Looking up service:', service);
    const serviceDoc = await Service.findById(service);

    if (!serviceDoc) {
      console.log('❌ Service not found:', service);
      return res.status(404).json({ message: 'Service not found' });
    }

    console.log('✅ Service found:', serviceDoc.name, 'Price:', serviceDoc.price);

    // Check for booking conflicts
    const existingBooking = await Booking.findOne({
      $or: [
        // Same staff, same time
        {
          staff: staff,
          date: new Date(date),
          time: time,
          status: { $in: ['pending', 'confirmed'] }
        },
        // Same user, same time (prevent double booking)
        {
          user: req.user._id,
          date: new Date(date),
          time: time,
          status: { $in: ['pending', 'confirmed'] }
        }
      ]
    });

    if (existingBooking) {
      if (existingBooking.staff?.toString() === staff?.toString()) {
        return res.status(400).json({
          message: 'Staff member already has a booking at this date and time'
        });
      } else {
        return res.status(400).json({
          message: 'You already have a booking at this date and time'
        });
      }
    }

    // Create booking
    const booking = new Booking({
      user: req.user._id,
      service,
      staff: staff || null, // staff is optional in your model
      date: new Date(date),
      time,
      duration: serviceDoc.duration,
      specialRequests: specialRequests || '',
      price: serviceDoc.price
    });

    console.log('💾 Saving booking to database...');
    await booking.save();

    // Populate the booking for response - USE CORRECT FIELD NAMES
    await booking.populate('service', 'name price duration');
    await booking.populate('staff', 'name email'); // Use 'staff' not 'assignedStaff'

    console.log('✅ Booking created successfully:', booking._id);

    res.status(201).json(booking);

  } catch (error) {
    console.error('❌ Booking creation error:', error);
    res.status(500).json({
      message: 'Server error creating booking',
      error: error.message
    });
  }
});

// Get user's bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('service', 'name price duration category')
      .populate('staff', 'name email'); // Use 'staff' not 'assignedStaff'
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Get staff's assigned bookings
router.get('/staff/my-bookings', auth, async (req, res) => {
    try {
        const bookings = await Booking.find({ 
            $or: [
                { staff: req.user._id },
                { assignedStaff: req.user._id }
            ]
        })
        .populate('service', 'name price duration')
        .populate('user', 'name email phone')
        .sort({ date: -1 });
        
        res.json(bookings);
    } catch (error) {
        console.error('Get staff bookings error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all bookings (staff and admin)
router.get('/', staffAuth, async (req, res) => {
  try {
    let bookings;
    if (req.user.role === 'admin') {
      bookings = await Booking.find()
        .populate('user', 'name email phone')
        .populate('service', 'name price duration')
        .populate('staff', 'name email'); // Use 'staff' not 'assignedStaff'
    } else {
      // For staff, show bookings assigned to them
      bookings = await Booking.find({ staff: req.user._id })
        .populate('user', 'name email phone')
        .populate('service', 'name price duration')
        .populate('staff', 'name email'); // Use 'staff' not 'assignedStaff'
    }
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// In bookings.js
router.get('/search', staffAuth, async (req, res) => {
  const { q } = req.query;
  const bookings = await Booking.find({
    $or: [
      { 'user.name': { $regex: q, $options: 'i' } },
      { 'service.name': { $regex: q, $options: 'i' } }
    ]
  }).populate('user service staff');
  res.json(bookings);
});

// Assign staff to booking (Admin only)

// Bulk assign staff to multiple bookings (Admin only)
router.patch('/bulk/assign-staff', auth, async (req, res) => {
  try {
    const { bookingIds, staffId } = req.body;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can assign staff to bookings'
      });
    }

    // Validate staff exists
    const User = require('../models/User');
    const staffMember = await User.findById(staffId);
    if (!staffMember || (staffMember.role !== 'staff' && staffMember.role !== 'admin')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff member selected'
      });
    }

    // Update all bookings
    const result = await Booking.updateMany(
      { _id: { $in: bookingIds } },
      {
        staff: staffId,
        status: 'confirmed'
      }
    );

    // Get updated bookings for response
    const updatedBookings = await Booking.find({ _id: { $in: bookingIds } })
      .populate('user', 'name email')
      .populate('service', 'name')
      .populate('staff', 'name');

    console.log(`✅ Bulk assignment: ${result.modifiedCount} bookings assigned to ${staffMember.name}`);

    res.json({
      success: true,
      message: `Assigned ${staffMember.name} to ${result.modifiedCount} bookings`,
      modifiedCount: result.modifiedCount,
      bookings: updatedBookings
    });

  } catch (error) {
    console.error('❌ Bulk staff assignment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in bulk staff assignment',
      error: error.message
    });
  }
});

// Get unassigned bookings (Admin only)
router.get('/unassigned', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can view unassigned bookings'
      });
    }

    const unassignedBookings = await Booking.find({
      staff: { $exists: false }
    })
      .populate('user', 'name email phone')
      .populate('service', 'name price duration')
      .sort({ date: 1, time: 1 });

    console.log(`📋 Found ${unassignedBookings.length} unassigned bookings`);

    res.json({
      success: true,
      count: unassignedBookings.length,
      bookings: unassignedBookings
    });

  } catch (error) {
    console.error('❌ Error fetching unassigned bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unassigned bookings',
      error: error.message
    });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    console.log('=== BOOKING UPDATE REQUEST ===');
    console.log('Booking ID:', req.params.id);
    console.log('Request Body:', req.body);

    const { status, assignedStaff, staff, specialRequests } = req.body;
    const updateData = {};

    if (status) updateData.status = status;

    // Use 'staff' field (not 'assignedStaff')
    if (staff) {
      updateData.staff = staff;
    } else if (assignedStaff) {
      // Fallback: if frontend sends assignedStaff, map it to staff
      updateData.staff = assignedStaff;
    }

    if (specialRequests) updateData.specialRequests = specialRequests;

    console.log('Update Data:', updateData);

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).populate('user', 'name email')
      .populate('service', 'name price duration')
      .populate('staff', 'name email'); // Changed to 'staff'

    if (!booking) {
      console.log('❌ Booking not found');
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    console.log('✅ Booking updated successfully:', booking._id);
    res.json({ success: true, booking });

  } catch (error) {
    console.log('=== BOOKING UPDATE ERROR ===');
    console.log('Error Name:', error.name);
    console.log('Error Message:', error.message);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// Booking reminder service (run via cron job)
router.post('/send-reminders', adminAuth, async (req, res) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcomingBookings = await Booking.find({
      date: {
        $gte: new Date(tomorrow.setHours(0, 0, 0, 0)),
        $lt: new Date(tomorrow.setHours(23, 59, 59, 999))
      },
      status: 'confirmed'
    }).populate('user', 'name email').populate('service', 'name');

    let sentCount = 0;
    for (const booking of upcomingBookings) {
      try {
        await emailTransporter.sendMail({
          from: process.env.EMAIL_USER,
          to: booking.user.email,
          subject: '🔔 Reminder: Your Tassel Group Booking Tomorrow',
          html: `
            <h2>Booking Reminder</h2>
            <p>Hi ${booking.user.name},</p>
            <p>This is a friendly reminder about your booking tomorrow:</p>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
              <p><strong>Service:</strong> ${booking.service.name}</p>
              <p><strong>Date:</strong> ${booking.date.toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${booking.time}</p>
            </div>
            <p>We look forward to seeing you!</p>
          `
        });
        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send email to ${booking.user.email}:`, emailError);
      }
    }

    res.json({
      success: true,
      message: `Sent ${sentCount} booking reminders`
    });
  } catch (error) {
    console.error('Booking reminder error:', error);
    res.status(500).json({ success: false, message: 'Error sending reminders' });
  }
});

// Get bookings by staff member
router.get('/staff/:staffId', staffAuth, async (req, res) => {
  try {
    const bookings = await Booking.find({ staff: req.params.staffId })
      .populate('user', 'name email phone')
      .populate('service', 'name price duration')
      .populate('staff', 'name email');

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching staff bookings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get bookings for a specific user (for staff/admin dashboards)
router.get('/user/:userId', staffAuth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.params.userId })
      .populate('service', 'name price duration category')
      .populate('staff', 'name email');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


module.exports = router;