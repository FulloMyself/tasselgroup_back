const express = require('express');
const GiftOrder = require('../models/GiftOrder');
const GiftPackage = require('../models/GiftPackage');
const { auth, staffAuth } = require('../middleware/auth');

const router = express.Router();

// Create gift order
router.post('/', auth, async (req, res) => {
  try {
    const { giftPackage, recipientName, recipientEmail, message, deliveryDate, assignedStaff } = req.body;

    console.log('🎁 Gift order creation request:', {
      user: req.user._id,
      body: req.body
    });

    // Validate required fields
    if (!giftPackage) {
      return res.status(400).json({ message: 'Gift package ID is required' });
    }
    if (!recipientName) {
      return res.status(400).json({ message: 'Recipient name is required' });
    }
    if (!recipientEmail) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }
    if (!deliveryDate) {
      return res.status(400).json({ message: 'Delivery date is required' });
    }

    // Find the gift package to get price
    const giftPackageDoc = await GiftPackage.findById(giftPackage);
    if (!giftPackageDoc) {
      return res.status(404).json({ message: 'Gift package not found' });
    }

    // Create gift order
    const giftOrder = new GiftOrder({
      user: req.user._id,
      giftPackage,
      recipientName,
      recipientEmail,
      message: message || '',
      deliveryDate: new Date(deliveryDate),
      price: giftPackageDoc.basePrice || giftPackageDoc.price || 0,
      assignedStaff: assignedStaff || null,
      status: 'pending'
    });

    await giftOrder.save();
    await giftOrder.populate('giftPackage', 'name description basePrice includes');
    await giftOrder.populate('assignedStaff', 'name email');

    console.log('✅ Gift order created successfully:', giftOrder._id);

    res.status(201).json(giftOrder);

  } catch (error) {
    console.error('❌ Gift order creation error:', error);
    res.status(500).json({ 
      message: 'Server error creating gift order',
      error: error.message
    });
  }
});

// Get user's gift orders
router.get('/my-gift-orders', auth, async (req, res) => {
  try {
    const giftOrders = await GiftOrder.find({ user: req.user._id })
      .populate('giftPackage', 'name description basePrice includes')
      .populate('assignedStaff', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(giftOrders);
  } catch (error) {
    console.error('Error fetching user gift orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all gift orders (staff and admin)
router.get('/', staffAuth, async (req, res) => {
  try {
    let giftOrders;
    if (req.user.role === 'admin') {
      giftOrders = await GiftOrder.find()
        .populate('user', 'name email')
        .populate('giftPackage', 'name description basePrice includes')
        .populate('assignedStaff', 'name email')
        .sort({ createdAt: -1 });
    } else {
      // Staff can see orders assigned to them
      giftOrders = await GiftOrder.find({ assignedStaff: req.user._id })
        .populate('user', 'name email')
        .populate('giftPackage', 'name description basePrice includes')
        .populate('assignedStaff', 'name email')
        .sort({ createdAt: -1 });
    }
    
    res.json(giftOrders);
  } catch (error) {
    console.error('Error fetching gift orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update gift order status
router.put('/:id/status', staffAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const giftOrder = await GiftOrder.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('user', 'name email')
      .populate('giftPackage', 'name description basePrice includes')
      .populate('assignedStaff', 'name email');

    if (!giftOrder) {
      return res.status(404).json({ message: 'Gift order not found' });
    }

    res.json(giftOrder);
  } catch (error) {
    console.error('Error updating gift order status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;