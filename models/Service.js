const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  duration: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['massage', 'Massage', 'skincare', 'Skincare', 'makeup', 'Makeup', 'wellness', 'Wellness', 'nails', 'Nails', 'haircare', 'Haircare', 'spa', 'Spa']
  },
  available: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    default: ''
  },
  staff: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Service', serviceSchema);