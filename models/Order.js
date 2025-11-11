const mongoose = require('mongoose');

// ============================================================
// Order Item Schema
// ============================================================
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

// ============================================================
// Order Schema
// ============================================================
const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: {
    type: [orderItemSchema],
    validate: [arr => arr.length > 0, 'Order must have at least one item']
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalTotal: {
    type: Number,
    required: true,
    min: 0
  },
  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher',
    default: null
  },
  shippingAddress: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'payfast', 'manual', 'bank_transfer'],
    default: 'card'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'manual'],
    default: 'pending'
  },
  paymentReference: {
    type: String,
    default: ''
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  trackingNumber: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// ============================================================
// Indexes
// ============================================================
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: 1 });

// ============================================================
// Virtuals
// ============================================================
orderSchema.virtual('orderSummary').get(function() {
  return `${this.items.length} item${this.items.length !== 1 ? 's' : ''} - R ${this.finalTotal}`;
});

// ============================================================
// Methods
// ============================================================
orderSchema.methods.calculateTotals = function() {
  this.total = this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  this.finalTotal = this.total - this.discount;
  return this;
};

// ============================================================
// Static helpers
// ============================================================
orderSchema.statics.getOrdersByStatus = function(status) {
  return this.find({ status })
    .populate({ path: 'user', select: 'name email phone' })
    .populate({ path: 'items.product', select: 'name price image' })
    .populate({ path: 'voucher', select: 'code discount type' })
    .populate({ path: 'processedBy', select: 'name email role' })
    .sort({ createdAt: -1 });
};

orderSchema.statics.getRevenueStats = async function() {Trackk
  const result = await this.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$finalTotal' },
        averageOrderValue: { $avg: '$finalTotal' },
        totalOrders: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalRevenue: 0, averageOrderValue: 0, totalOrders: 0 };
};

// ============================================================
// Export
// ============================================================
module.exports = mongoose.model('Order', orderSchema);
