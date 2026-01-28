const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get staff members (PUBLIC - no auth required)
// Include admins as part of staff dropdowns since admins can act as senior staff
router.get('/staff', async (req, res) => {
  try {
    const staffMembers = await User.find({ role: { $in: ['staff', 'admin'] } }).select('name email role phone position');
    res.json(staffMembers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get staff members with auth
// Include admins in the list so admin users appear alongside staff
router.get('/staff/auth', auth, async (req, res) => {
  try {
    const staffMembers = await User.find({ role: { $in: ['staff', 'admin'] } }).select('name email role phone position');
    res.json(staffMembers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// NOTE: parameterized routes (/:id) are defined AFTER specific routes like '/profile'
// to avoid accidental matching of literal paths like '/profile' as an :id.

// Update user profile (authenticated users can update their own profile)
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    // Check if email is already taken by another user
    const existingUser = await User.findOne({
      email,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email is already taken' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim(),
        address: address?.trim()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id);

    // Verify current password (you need to implement this in your User model)
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user profile
router.get('/profile/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user by ID (admin only) - placed after specific routes to avoid parameter capture
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user by ID (admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { name, email, phone, address, role } = req.body;

    const update = {};
    if (typeof name === 'string' && name.trim() !== '') update.name = name.trim();
    if (typeof email === 'string' && email.trim() !== '') update.email = email.trim();
    if (typeof phone === 'string') update.phone = phone.trim();
    if (typeof address === 'string') update.address = address.trim();
    if (typeof role === 'string' && ['customer', 'staff', 'admin'].includes(role)) update.role = role;

    const updatedUser = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(updatedUser);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid user ID' });
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Validation error', error: error.message });
    console.error('User update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete user by ID (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent deleting yourself
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      message: 'User deleted successfully',
      deletedUser: {
        _id: deletedUser._id,
        name: deletedUser.name,
        email: deletedUser.email
      }
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid user ID' });
    console.error('User delete error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;