const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'staff', 'admin'], default: 'customer' },
  phone: String,
  address: String,
  leaveBalance: {
    annual: { type: Number, default: 21 },
    sick: { type: Number, default: 10 },
    family: { type: Number, default: 3 }
  }
  ,
  // Track the user's last successful login time
  lastLogin: { type: Date }
}, {
  timestamps: true
});

// Add password comparison method if it doesn't exist
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Add pre-save hook for password hashing if it doesn't exist
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('User', userSchema);