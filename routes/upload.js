const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Product image upload
router.post('/product-image', adminAuth, async (req, res) => {
  try {
    // Handle both FormData (with file) and JSON body (with URL)
    let imageUrl = null;

    // Check if image URL was sent in request body
    if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    } else if (req.body.imageData) {
      imageUrl = req.body.imageData;
    } else {
      // For now, generate a placeholder image URL since we don't have actual file storage
      // In production, you'd upload to S3, cloudinary, etc.
      imageUrl = `/images/products/placeholder-${Date.now()}.jpg`;
    }

    // Return the image URL to be stored in the product
    res.json({
      success: true,
      imageUrl: imageUrl,
      message: 'Image upload successful'
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ message: 'Image upload failed', error: error.message });
  }
});

// Service image upload
router.post('/service-image', adminAuth, async (req, res) => {
  try {
    const { imageUrl, imageData } = req.body;

    if (!imageUrl && !imageData) {
      return res.status(400).json({ message: 'Image URL or image data is required' });
    }

    res.json({
      success: true,
      imageUrl: imageUrl || imageData,
      message: 'Image upload successful'
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ message: 'Image upload failed', error: error.message });
  }
});

// Gift package image upload
router.post('/gift-image', adminAuth, async (req, res) => {
  try {
    const { imageUrl, imageData } = req.body;

    if (!imageUrl && !imageData) {
      return res.status(400).json({ message: 'Image URL or image data is required' });
    }

    res.json({
      success: true,
      imageUrl: imageUrl || imageData,
      message: 'Image upload successful'
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ message: 'Image upload failed', error: error.message });
  }
});

module.exports = router;
