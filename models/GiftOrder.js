const mongoose = require('mongoose');

const giftOrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  giftPackage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GiftPackage',
    required: true
  },
  recipientName: {
    type: String,
    required: true,
    trim: true
  },
  recipientEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  message: {
    type: String,
    default: '',
    trim: true
  },
  deliveryDate: {
    type: Date,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'scheduled', 'delivered', 'cancelled'],
    default: 'pending'
  },
  // ADDED: Payment fields
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
  assignedStaff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for better query performance
giftOrderSchema.index({ user: 1, createdAt: -1 });
giftOrderSchema.index({ recipientEmail: 1 });
giftOrderSchema.index({ deliveryDate: 1 });

// Virtual for formatted delivery date
giftOrderSchema.virtual('formattedDeliveryDate').get(function() {
  return this.deliveryDate.toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

module.exports = mongoose.model('GiftOrder', giftOrderSchema);