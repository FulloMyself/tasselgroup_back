const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  specialRequests: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  // ADDED: Payment fields
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'manual'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'cash', 'payfast', 'manual', 'bank_transfer'],
    default: 'card'
  },
  paymentReference: {
    type: String
  },
  price: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Add index for better query performance
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ staff: 1, date: 1 });
bookingSchema.index({ status: 1, date: 1 });

// Virtual for formatted date
bookingSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Instance method to check if booking is upcoming
bookingSchema.methods.isUpcoming = function() {
  const now = new Date();
  const bookingDateTime = new Date(this.date);
  return bookingDateTime > now && this.status === 'confirmed';
};

// Instance method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function() {
  const now = new Date();
  const bookingDateTime = new Date(this.date);
  const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);
  return hoursUntilBooking > 24 && ['pending', 'confirmed'].includes(this.status);
};

// Static method to get bookings by date range
bookingSchema.statics.getBookingsByDateRange = function(startDate, endDate) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate('user', 'name email phone')
    .populate('service', 'name price duration')
    .populate('staff', 'name email')
    .sort({ date: 1, time: 1 });
};

// Static method to get upcoming bookings for a staff member
bookingSchema.statics.getUpcomingForStaff = function(staffId, limit = 10) {
  return this.find({
    staff: staffId,
    date: { $gte: new Date() },
    status: { $in: ['pending', 'confirmed'] }
  })
  .populate('user', 'name email phone')
  .populate('service', 'name price duration')
  .sort({ date: 1, time: 1 })
  .limit(limit);
};

// Static method to get booking statistics
bookingSchema.statics.getBookingStats = async function() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalBookings,
    todayBookings,
    weekBookings,
    monthBookings,
    statusCounts
  ] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ date: { $gte: startOfToday } }),
    this.countDocuments({ date: { $gte: startOfWeek } }),
    this.countDocuments({ date: { $gte: startOfMonth } }),
    this.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const statusMap = statusCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  return {
    total: totalBookings,
    today: todayBookings,
    thisWeek: weekBookings,
    thisMonth: monthBookings,
    byStatus: {
      pending: statusMap.pending || 0,
      confirmed: statusMap.confirmed || 0,
      completed: statusMap.completed || 0,
      cancelled: statusMap.cancelled || 0
    }
  };
};

// Middleware to validate booking date
bookingSchema.pre('save', function(next) {
  const bookingDate = new Date(this.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (bookingDate < today) {
    next(new Error('Booking date cannot be in the past'));
  } else {
    next();
  }
});

// Ensure virtual fields are serialized
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Booking', bookingSchema);