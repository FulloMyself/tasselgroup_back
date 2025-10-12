const express = require('express');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/staff', auth, async (req, res) => {
  try {
    const staffMembers = await User.find({ 
      role: { $in: ['staff', 'admin'] } 
    }).select('name email role phone');
    
    res.json(staffMembers);
  } catch (error) {
    console.error('Error fetching staff members:', error);
    res.status(500).json({ message: 'Error fetching staff members' });
  }
});


// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, phone, address },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create staff user (admin only)
router.post('/staff', adminAuth, async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    const user = new User({
      name,
      email,
      password,
      phone,
      address,
      role: 'staff'
    });

    await user.save();

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign staff to customer
router.put('/:userId/assign-staff', adminAuth, async (req, res) => {
  try {
    const { staffId } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { assignedStaff: staffId },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;