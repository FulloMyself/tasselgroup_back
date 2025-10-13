const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Voucher = require('../models/Voucher');
const { auth, staffAuth } = require('../middleware/auth');

const router = express.Router();

// Get all orders (staff and admin)
router.get('/', staffAuth, async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'admin') {
      orders = await Order.find()
        .populate('user', 'name email phone')
        .populate('items.product', 'name price image')
        .populate('voucher', 'code discount type')
        .populate('processedBy', 'name email role'); // Add processedBy population
    } else {
      // For staff, show orders they processed
      orders = await Order.find({ processedBy: req.user._id })
        .populate('user', 'name email phone')
        .populate('items.product', 'name price image')
        .populate('voucher', 'code discount type')
        .populate('processedBy', 'name email role'); // Add processedBy population
    }
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's orders
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name price image')
      .populate('voucher', 'code discount type')
      .populate('processedBy', 'name email role'); // Add processedBy population
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create order with staff assignment
router.post('/', auth, async (req, res) => {
  try {
    const { items, voucherCode, shippingAddress, paymentMethod, processedBy } = req.body;

    console.log('🛒 Order creation request:', {
      user: req.user._id,
      itemsCount: items?.length,
      processedBy
    });

    // Calculate total
    let total = 0;
    let discount = 0;

    for (let item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.product} not found` });
      }
      total += product.price * item.quantity;
    }

    // Apply voucher if provided
    let voucher = null;
    if (voucherCode) {
      voucher = await Voucher.findOne({ 
        code: voucherCode.toUpperCase(),
        isActive: true,
        validUntil: { $gte: new Date() }
      });

      if (voucher && voucher.used < voucher.maxUses) {
        if (voucher.type === 'percentage') {
          discount = total * (voucher.discount / 100);
        } else {
          discount = voucher.discount;
        }
        voucher.used += 1;
        await voucher.save();
      }
    }

    const finalTotal = total - discount;

    const order = new Order({
      user: req.user._id,
      items,
      total,
      discount,
      finalTotal,
      shippingAddress: shippingAddress || req.user.address,
      paymentMethod,
      voucher: voucher?._id,
      processedBy: processedBy || null // Add staff assignment
    });

    await order.save();
    await order.populate('items.product', 'name price image');
    await order.populate('voucher', 'code discount type');
    await order.populate('processedBy', 'name email role');

    console.log('✅ Order created successfully:', order._id);

    res.status(201).json(order);
  } catch (error) {
    console.error('❌ Order creation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update order status
router.put('/:id/status', staffAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate('user', 'name email phone')
      .populate('items.product', 'name price image')
      .populate('voucher', 'code discount type')
      .populate('processedBy', 'name email role');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// In routes/orders.js - Add public stats
router.get('/public-stats', async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments();
        const totalRevenue = await Order.aggregate([
            { $group: { _id: null, total: { $sum: '$finalTotal' } } }
        ]);
        
        res.json({
            totalOrders,
            totalRevenue: totalRevenue[0]?.total || 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// In routes/bookings.js - Add public stats
router.get('/public-stats', async (req, res) => {
    try {
        const totalBookings = await Booking.countDocuments();
        const totalRevenue = await Booking.aggregate([
            { $group: { _id: null, total: { $sum: '$price' } } }
        ]);
        
        res.json({
            totalBookings,
            totalRevenue: totalRevenue[0]?.total || 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;