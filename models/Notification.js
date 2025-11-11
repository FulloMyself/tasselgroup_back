const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['booking_reminder', 'order_update', 'payment_success', 'system'],
    default: 'system'
  },
  read: {
    type: Boolean,
    default: false
  },
  relatedEntity: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedEntityModel'
  },
  relatedEntityModel: {
    type: String,
    enum: ['Booking', 'Order', 'GiftOrder']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);