const express = require('express');
const GiftPackage = require('../models/GiftPackage');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all gift packages - FIXED VERSION
router.get('/', async (req, res) => {
  try {
    const giftPackages = await GiftPackage.find()
      .populate('services', 'name price duration')
      .populate('products', 'name price image')
      .lean(); // ADD THIS LINE - returns plain JavaScript objects
    
    console.log(`✅ Found ${giftPackages.length} gift packages`);
    res.json(giftPackages);
    
  } catch (error) {
    console.error('❌ Get gift packages error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get gift package by ID
router.get('/:id', async (req, res) => {
  try {
    const giftPackage = await GiftPackage.findById(req.params.id)
      .populate('services', 'name price duration')
      .populate('products', 'name price image');
    if (!giftPackage) {
      return res.status(404).json({ message: 'Gift package not found' });
    }
    res.json(giftPackage);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create gift package (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const giftPackage = new GiftPackage(req.body);
    await giftPackage.save();
    res.status(201).json(giftPackage);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update gift package (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const giftPackage = await GiftPackage.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!giftPackage) {
      return res.status(404).json({ message: 'Gift package not found' });
    }
    res.json(giftPackage);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete gift package (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const giftPackage = await GiftPackage.findByIdAndDelete(req.params.id);
    if (!giftPackage) {
      return res.status(404).json({ message: 'Gift package not found' });
    }
    res.json({ message: 'Gift package deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;