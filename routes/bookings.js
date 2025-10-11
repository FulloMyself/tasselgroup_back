const express = require('express');
const Booking = require('../models/Booking');
const { auth, staffAuth } = require('../middleware/auth');

const router = express.Router();

// Get all bookings (staff and admin)
router.get('/', staffAuth, async (req, res) => {
  try {
    let bookings;
    if (req.user.role === 'admin') {
      bookings = await Booking.find()
        .populate('user', 'name email phone')
        .populate('service', 'name price duration')
        .populate('staff', 'name email');
    } else {
      bookings = await Booking.find({ staff: req.user._id })
        .populate('user', 'name email phone')
        .populate('service', 'name price duration')
        .populate('staff', 'name email');
    }
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('service', 'name price duration category')
      .populate('staff', 'name email');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create booking
router.post('/', auth, async (req, res) => {
  try {
    const { service, staff, date, time, specialRequests } = req.body;

    const serviceDoc = await Service.findById(service);
    if (!serviceDoc) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const booking = new Booking({
      user: req.user._id,
      service,
      staff,
      date,
      time,
      duration: serviceDoc.duration,
      specialRequests,
      price: serviceDoc.price
    });

    await booking.save();
    await booking.populate('service', 'name price duration');
    await booking.populate('staff', 'name email');

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update booking status
router.put('/:id/status', staffAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('user', 'name email phone')
      .populate('service', 'name price duration')
      .populate('staff', 'name email');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;