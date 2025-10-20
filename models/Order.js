const mongoose = require('mongoose');

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
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  // ADDED: Payment status field
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'manual'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'payfast', 'manual', 'bank_transfer'],
    default: 'card'
  },
  paymentReference: {
    type: String
  },
  shippingAddress: {
    type: String,
    required: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
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
  trackingNumber: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for better query performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: 1 });

// Virtual for order summary
orderSchema.virtual('orderSummary').get(function() {
  return `${this.items.length} item${this.items.length !== 1 ? 's' : ''} - R ${this.finalTotal}`;
});

// Instance method to calculate totals
orderSchema.methods.calculateTotals = function() {
  this.total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  this.finalTotal = this.total - this.discount;
  return this;
};

// Static method to get orders by status
orderSchema.statics.getOrdersByStatus = function(status) {
  return this.find({ status })
    .populate('user', 'name email phone')
    .populate('items.product', 'name price image')
    .populate('voucher', 'code discount type')
    .sort({ createdAt: -1 });
};

// Static method to get revenue statistics
orderSchema.statics.getRevenueStats = async function() {
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

module.exports = mongoose.model('Order', orderSchema);