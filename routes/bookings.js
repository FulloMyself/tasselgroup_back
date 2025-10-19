const express = require('express');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { auth, staffAuth } = require('../middleware/auth');

const router = express.Router();

// Create booking
router.post('/', auth, async (req, res) => {
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

// Assign staff to booking (Admin only)
router.patch('/:id/assign-staff', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { staffId } = req.body;

        console.log(`🔄 Assigning staff ${staffId} to booking ${id}`);

        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can assign staff to bookings'
            });
        }

        // Validate staff exists and is actually a staff member
        const User = require('../models/User');
        const staffMember = await User.findById(staffId);
        if (!staffMember || (staffMember.role !== 'staff' && staffMember.role !== 'admin')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid staff member selected. Please select a staff member.'
            });
        }

        const booking = await Booking.findByIdAndUpdate(
            id,
            { 
                staff: staffId,
                status: 'confirmed' // Automatically confirm when staff is assigned
            },
            { new: true }
        )
        .populate('user', 'name email phone')
        .populate('service', 'name price duration')
        .populate('staff', 'name email');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        console.log(`✅ Staff assigned successfully: ${staffMember.name} to booking ${id}`);
        
        res.json({
            success: true,
            message: `${staffMember.name} has been assigned to ${booking.user.name}'s ${booking.service.name} booking`,
            booking
        });

    } catch (error) {
        console.error('❌ Staff assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning staff to booking',
            error: error.message
        });
    }
});

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

router.patch('/:id/status', staffAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        console.log(`🔄 Updating booking ${id} status to: ${status}`);

        const booking = await Booking.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        ).populate('user service staff');

        if (!booking) {
            return res.status(404).json({ 
                success: false, 
                message: 'Booking not found' 
            });
        }

        console.log(`✅ Booking status updated successfully: ${booking.status}`);
        res.json({ 
            success: true, 
            booking 
        });

    } catch (error) {
        console.error('❌ Booking status update error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating booking status',
            error: error.message 
        });
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

module.exports = router;