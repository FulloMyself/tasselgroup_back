const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true, // This automatically creates an index - REMOVE THE DUPLICATE
    uppercase: true,
    trim: true
  },
  discount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  // Make assignedTo optional
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  used: {
    type: Number,
    default: 0,
    min: 0
  },
  maxUses: {
    type: Number,
    required: true,
    min: 1
  },
  validUntil: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for better query performance - REMOVED code:1 index (duplicate)
voucherSchema.index({ assignedTo: 1 });
voucherSchema.index({ validUntil: 1 });
voucherSchema.index({ isActive: 1 });

// Virtual for remaining uses
voucherSchema.virtual('remainingUses').get(function () {
  return this.maxUses - this.used;
});

// Virtual for isExpired
voucherSchema.virtual('isExpired').get(function () {
  return new Date() > this.validUntil;
});

// Virtual for canBeUsed
voucherSchema.virtual('canBeUsed').get(function () {
  return this.isActive && !this.isExpired && this.used < this.maxUses;
});

// Instance method to apply discount
voucherSchema.methods.applyDiscount = function (originalAmount) {
  if (!this.canBeUsed) {
    throw new Error('Voucher cannot be used');
  }

  let discountAmount = 0;

  if (this.type === 'percentage') {
    discountAmount = originalAmount * (this.discount / 100);
  } else {
    discountAmount = Math.min(this.discount, originalAmount);
  }

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalAmount: Math.round((originalAmount - discountAmount) * 100) / 100
  };
};

// Instance method to mark as used
voucherSchema.methods.markAsUsed = function () {
  if (this.used >= this.maxUses) {
    throw new Error('Voucher has reached maximum usage limit');
  }

  if (this.isExpired) {
    throw new Error('Voucher has expired');
  }

  if (!this.isActive) {
    throw new Error('Voucher is not active');
  }

  this.used += 1;

  // Deactivate if reached max uses
  if (this.used >= this.maxUses) {
    this.isActive = false;
  }

  return this.save();
};

// Static method to find valid voucher - FIXED VERSION
voucherSchema.statics.findValidVoucher = function (code, staffId = null) {
  const query = {
    code: code.toUpperCase().trim(),
    isActive: true,
    validUntil: { $gte: new Date() },
    $expr: { $lt: ['$used', '$maxUses'] }
  };
  
  // Handle both assigned and unassigned vouchers
  if (staffId) {
    query.$or = [
      { assignedTo: staffId },
      { assignedTo: { $exists: false } },
      { assignedTo: null }
    ];
  }
  
  return this.findOne(query).populate('assignedTo', 'name email');
};

// Static method to get voucher usage statistics
voucherSchema.statics.getVoucherStats = async function () {
  const result = await this.aggregate([
    {
      $group: {
        _id: '$assignedTo',
        totalVouchers: { $sum: 1 },
        totalUses: { $sum: '$used' },
        activeVouchers: {
          $sum: {
            $cond: [
              { $and: ['$isActive', { $gt: ['$validUntil', new Date()] }] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'staff'
      }
    }
  ]);

  return result;
};

// Middleware to validate voucher data
voucherSchema.pre('save', function (next) {
  if (this.type === 'percentage' && this.discount > 100) {
    next(new Error('Percentage discount cannot exceed 100%'));
  }

  if (this.validUntil <= new Date()) {
    next(new Error('Voucher expiration date must be in the future'));
  }

  next();
});

// Ensure virtual fields are serialized
voucherSchema.set('toJSON', { virtuals: true });
voucherSchema.set('toObject', { virtuals: true });

module.exports = mongoose.models.Voucher || mongoose.model('Voucher', voucherSchema);