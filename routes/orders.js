const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Voucher = require('../models/Voucher');
const { auth, staffAuth, adminAuth } = require('../middleware/auth');

// ❗ Missing imports that caused 500 errors
const Booking = require('../models/Booking');
const GiftOrder = require('../models/GiftOrder');

const router = express.Router();

/* ===========================================================
   GET ALL ORDERS (Admin or Staff)
   =========================================================== */
// In routes/orders.js - UPDATE the GET endpoint:
router.get('/', staffAuth, async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'admin') {
      orders = await Order.find()
        .populate('user', 'name email phone')
        .populate('items.product', 'name price image')
        .populate('voucher', 'code discount type')
        .populate('processedBy', 'name email role')
        .lean(); // ADD THIS LINE
    } else {
      // For staff, show orders they processed
      orders = await Order.find({ processedBy: req.user._id })
        .populate('user', 'name email phone')
        .populate('items.product', 'name price image')
        .populate('voucher', 'code discount type')
        .populate('processedBy', 'name email role')
        .lean(); // ADD THIS LINE
    }

    // FIX: Return proper array, not wrapped object
    res.json(orders); // Changed from res.json(orders) to return array directly

  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ===========================================================
   GET CURRENT USER'S ORDERS
   =========================================================== */
router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name price image')
      .populate('voucher', 'code discount type')
      .populate('processedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error('❌ Error fetching user orders:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ===========================================================
   CREATE ORDER
   =========================================================== */
router.post('/', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, voucherCode, shippingAddress, paymentMethod, processedBy } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    let total = 0;
    let discount = 0;

    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) throw new Error(`Product ${item.product} not found`);

      if (!product.inStock || product.stockQuantity < item.quantity) {
        throw new Error(
          `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`
        );
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
      }).session(session);

      if (voucher && voucher.used < voucher.maxUses) {
        discount = voucher.type === 'percentage'
          ? total * (voucher.discount / 100)
          : Math.min(voucher.discount, total);

        voucher.used += 1;
        await voucher.save({ session });
      }
    }

    const finalTotal = total - discount;

    const order = new Order({
      user: req.user._id,
      items: items.map(i => ({
        product: i.product,
        quantity: i.quantity,
        price: i.price
      })),
      total,
      discount,
      finalTotal,
      shippingAddress: shippingAddress || req.user.address,
      paymentMethod,
      voucher: voucher?._id || null,
      processedBy: processedBy || null
    });

    await order.save({ session });

    // Update product stock
    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      product.stockQuantity -= item.quantity;
      product.inStock = product.stockQuantity > 0;
      await product.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    await order.populate('items.product', 'name price image');
    await order.populate('voucher', 'code discount type');
    await order.populate('processedBy', 'name email role');

    res.status(201).json(order);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ Order creation error:', error);
    res.status(500).json({ message: 'Server error creating order', error: error.message });
  }
});

// PATCH /api/orders/:id - Update order
router.patch('/:id', auth, async (req, res) => {
  try {
    const { status, processedBy, paymentStatus, trackingNumber } = req.body;
    const updateData = {};

    if (status) updateData.status = status;
    if (processedBy) updateData.processedBy = processedBy; // Only process processedBy
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (trackingNumber) updateData.trackingNumber = trackingNumber;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('user', 'name email')
      .populate('items.product', 'name price image')
      .populate('processedBy', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ===========================================================
   BULK STATUS UPDATE (Admin)
   =========================================================== */
router.patch('/bulk/status', adminAuth, async (req, res) => {
  try {
    const { orderIds, status } = req.body;

    if (!orderIds?.length) {
      return res.status(400).json({ success: false, message: 'Order IDs array is required' });
    }

    const result = await Order.updateMany({ _id: { $in: orderIds } }, { status });

    const updatedOrders = await Order.find({ _id: { $in: orderIds } })
      .populate('user', 'name email')
      .populate('items.product', 'name price');

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} orders to ${status}`,
      modifiedCount: result.modifiedCount,
      orders: updatedOrders
    });
  } catch (error) {
    console.error('❌ Bulk order update error:', error);
    res.status(500).json({ success: false, message: 'Error updating orders in bulk' });
  }
});

/* ===========================================================
   UPDATE SINGLE ORDER STATUS (Staff)
   =========================================================== */
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

    if (!order) return res.status(404).json({ message: 'Order not found' });

    res.json(order);
  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/* ===========================================================
   PUBLIC STATS
   =========================================================== */
router.get('/public-stats', async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$finalTotal' } } }]);
    res.json({ totalOrders, totalRevenue: totalRevenue[0]?.total || 0 });
  } catch (error) {
    console.error('❌ Public stats error:', error);
    res.status(500).json({ message: 'Server error fetching stats' });
  }
});

/* ===========================================================
   EXPORT ORDERS TO CSV (Admin)
   =========================================================== */
router.get('/export/csv', adminAuth, async (req, res) => {
  try {
    const orders = await Order.find().populate('user items.product');
    // TODO: Implement CSV export
    res.json({ success: true, message: 'CSV export placeholder', count: orders.length });
  } catch (error) {
    res.status(500).json({ message: 'Error exporting orders', error: error.message });
  }
});

/* ===========================================================
   USER DASHBOARD ROUTES (for /my-* endpoints)
   =========================================================== */
router.get('/bookings/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('service', 'name price duration')
      .populate('staff', 'name')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/gift-orders/my-gifts', auth, async (req, res) => {
  try {
    const gifts = await GiftOrder.find({ user: req.user._id })
      .populate('giftPackage', 'name basePrice')
      .populate('assignedStaff', 'name')
      .sort({ createdAt: -1 });
    res.json(gifts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get staff's processed orders
router.get('/staff/my-orders', auth, async (req, res) => {
    try {
        const orders = await Order.find({ 
            $or: [
                { processedBy: req.user._id },
                { assignedStaff: req.user._id }
            ]
        })
        .populate('user', 'name email phone')
        .populate('items.product', 'name price')
        .sort({ createdAt: -1 });
        
        res.json(orders);
    } catch (error) {
        console.error('Get staff orders error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all orders for a specific user (for staff/admin dashboards)
router.get('/user/:userId', staffAuth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.params.userId })
      .populate('items.product', 'name price image')
      .populate('voucher', 'code discount type')
      .populate('processedBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



module.exports = router;
