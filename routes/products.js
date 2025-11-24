const express = require('express');
const Product = require('../models/Product');
const { auth, adminAuth } = require('../middleware/auth');
const cacheMiddleware = require('../middleware/cache');

const router = express.Router();

// Get all products
router.get('/', cacheMiddleware(300), async (req, res) => {
  try {
    const { category, inStock, page = 1, limit = 10 } = req.query;
    
    let filter = {};
    
    if (category) {
      filter.category = category;
    }
    
    if (inStock !== undefined) {
      filter.inStock = inStock === 'true';
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const products = await Product.find(filter)
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments(filter);
    
    res.json({
      products,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    console.error('Get product by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create product (admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, description, price, category, image, inStock, stockQuantity, tags } = req.body;
    
    // Validation
    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }
    
    if (price < 0) {
      return res.status(400).json({ message: 'Price cannot be negative' });
    }
    
    const product = new Product({
      name,
      description,
      price,
      category,
      image,
      inStock: inStock !== undefined ? inStock : true,
      stockQuantity: stockQuantity || 0,
      tags: tags || []
    });
    
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update product (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update product stock (admin only)
router.patch('/:id/stock', adminAuth, async (req, res) => {
  try {
    const { stockQuantity, inStock } = req.body;
    
    if (stockQuantity === undefined && inStock === undefined) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    const updateData = {};
    if (stockQuantity !== undefined) {
      if (stockQuantity < 0) {
        return res.status(400).json({ message: 'Stock quantity cannot be negative' });
      }
      updateData.stockQuantity = stockQuantity;
    }
    if (inStock !== undefined) updateData.inStock = inStock;
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    console.error('Update stock error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete product (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get products by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const products = await Product.find({ category, inStock: true })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments({ category, inStock: true });
    
    res.json({
      products,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search products
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const searchRegex = new RegExp(query, 'i');
    
    const products = await Product.find({
      $and: [
        { inStock: true },
        {
          $or: [
            { name: searchRegex },
            { description: searchRegex },
            { tags: { $in: [searchRegex] } }
          ]
        }
      ]
    })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });
    
    const total = await Product.countDocuments({
      $and: [
        { inStock: true },
        {
          $or: [
            { name: searchRegex },
            { description: searchRegex },
            { tags: { $in: [searchRegex] } }
          ]
        }
      ]
    });
    
    res.json({
      products,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total
    });
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;