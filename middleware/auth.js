const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    // First call the regular auth middleware
    await new Promise((resolve, reject) => {
      auth(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Then check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }

    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    // Don't send response here - auth middleware already handled it
    if (!res.headersSent) {
      return res.status(401).json({ message: 'Authentication failed' });
    }
  }
};

const staffAuth = async (req, res, next) => {
  try {
    // First call the regular auth middleware
    await new Promise((resolve, reject) => {
      auth(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // Then check if user is staff or admin
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Staff or Admin role required.' });
    }

    next();
  } catch (error) {
    console.error('Staff auth middleware error:', error);
    // Don't send response here - auth middleware already handled it
    if (!res.headersSent) {
      return res.status(401).json({ message: 'Authentication failed' });
    }
  }
};

module.exports = { auth, adminAuth, staffAuth };