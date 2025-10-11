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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get staff's vouchers
router.get('/my-vouchers', staffAuth, async (req, res) => {
  try {
    const vouchers = await Voucher.find({ assignedTo: req.user._id });
    res.json(vouchers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create voucher (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const voucher = new Voucher(req.body);
    await voucher.save();
    await voucher.populate('assignedTo', 'name email');
    res.status(201).json(voucher);
  } catch (error) {
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;