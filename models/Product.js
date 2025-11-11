const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
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
  category: {
    type: String,
    required: true,
    enum: ['skincare', 'haircare', 'Wellness', 'wellness', 'makeup', 'fragrance']
  },
  image: {
    type: String,
    required: true
  },
  inStock: {
    type: Boolean,
    default: true
  },
  stockQuantity: {
    type: Number,
    default: 0
  },
  tags: [String]
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);