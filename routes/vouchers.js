const express = require('express');
const Voucher = require('../models/Voucher');
const { auth, adminAuth, staffAuth } = require('../middleware/auth');
const cacheMiddleware = require('../middleware/cache');

const router = express.Router();

// Get all vouchers (admin only)
router.get('/', cacheMiddleware(300), adminAuth, async (req, res) => {
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

// Create voucher (admin only) - FIXED VERSION
router.post('/', adminAuth, async (req, res) => {
  try {
    const { code, type, discount, validUntil, assignedTo, maxUses, description } = req.body;
    
    // Validation - FIXED FIELD NAMES
    if (!code || !type || !discount || !validUntil) {
      return res.status(400).json({ message: 'Code, type, discount, and validUntil are required' });
    }
    
    if (discount <= 0) {
      return res.status(400).json({ message: 'Discount value must be positive' });
    }
    
    if (type === 'percentage' && discount > 100) {
      return res.status(400).json({ message: 'Percentage discount cannot exceed 100%' });
    }
    
    const voucher = new Voucher({
      code: code.toUpperCase().trim(),
      type, // 'percentage' or 'fixed'
      discount: Number(discount),
      validUntil: new Date(validUntil),
      assignedTo: assignedTo || null, // Make optional
      maxUses: maxUses || 1,
      description: description || '',
      isActive: true
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

// Update voucher (admin only) - FIXED VERSION
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { code, type, discount, validUntil, assignedTo, maxUses, description, isActive } = req.body;
    
    const updateData = {};
    if (code) updateData.code = code.toUpperCase().trim();
    if (type) updateData.type = type;
    if (discount !== undefined) updateData.discount = Number(discount);
    if (validUntil) updateData.validUntil = new Date(validUntil);
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (maxUses !== undefined) updateData.maxUses = maxUses;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const voucher = await Voucher.findByIdAndUpdate(
      req.params.id,
      updateData,
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