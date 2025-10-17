const express = require('express');
const Voucher = require('../models/Voucher');
const { auth, adminAuth, staffAuth } = require('../middleware/auth');

const router = express.Router();

// Get all vouchers (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const vouchers = await Voucher.find().populate('assignedTo', 'name email');
    res.json(vouchers);
  } catch (error) {
    console.error('Get vouchers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get staff's vouchers
router.get('/my-vouchers', staffAuth, async (req, res) => {
  try {
    const vouchers = await Voucher.find({ assignedTo: req.user._id }).populate('assignedTo', 'name email');
    res.json(vouchers);
  } catch (error) {
    console.error('Get my vouchers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create voucher (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { code, discountType, discountValue, expiresAt, assignedTo } = req.body;
    
    // Validation
    if (!code || !discountType || !discountValue) {
      return res.status(400).json({ message: 'Code, discount type, and discount value are required' });
    }
    
    if (discountValue <= 0) {
      return res.status(400).json({ message: 'Discount value must be positive' });
    }
    
    const voucher = new Voucher({
      code,
      discountType,
      discountValue,
      expiresAt,
      assignedTo
    });
    
    await voucher.save();
    await voucher.populate('assignedTo', 'name email');
    res.status(201).json(voucher);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Voucher code already exists' });
    }
    console.error('Create voucher error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update voucher (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const voucher = await Voucher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }
    
    res.json(voucher);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid voucher ID' });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Voucher code already exists' });
    }
    console.error('Update voucher error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete voucher (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const voucher = await Voucher.findByIdAndDelete(req.params.id);
    if (!voucher) {
      return res.status(404).json({ message: 'Voucher not found' });
    }
    res.json({ message: 'Voucher deleted successfully' });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid voucher ID' });
    }
    console.error('Delete voucher error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;