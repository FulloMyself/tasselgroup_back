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