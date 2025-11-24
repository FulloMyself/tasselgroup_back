const express = require('express');
const Leave = require('../models/Leave');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Apply for leave (staff only)
router.post('/', auth, async (req, res) => {
    try {
        const { startDate, endDate, leaveType, reason } = req.body;
        
        // Validation
        if (!startDate || !endDate || !leaveType) {
            return res.status(400).json({ message: 'Start date, end date, and leave type are required' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start >= end) {
            return res.status(400).json({ message: 'End date must be after start date' });
        }

        // Calculate number of days (excluding weekends)
        const days = calculateWorkingDays(start, end);
        
        // Check if staff has enough leave days
        const staff = await User.findById(req.user._id);
        const availableLeave = getAvailableLeave(staff, leaveType);
        
        if (days > availableLeave) {
            return res.status(400).json({ 
                message: `Insufficient ${leaveType} leave days. Available: ${availableLeave}, Requested: ${days}` 
            });
        }

        const leave = new Leave({
            staff: req.user._id,
            startDate: start,
            endDate: end,
            leaveType,
            reason,
            days,
            status: 'pending'
        });

        await leave.save();
        await leave.populate('staff', 'name email role');
        
        res.status(201).json(leave);
    } catch (error) {
        console.error('Leave application error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get staff's own leave applications
router.get('/my-leave', auth, async (req, res) => {
    try {
        const leaves = await Leave.find({ staff: req.user._id })
            .populate('staff', 'name email')
            .sort({ createdAt: -1 });
        
        res.json(leaves);
    } catch (error) {
        console.error('Get my leave error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all leave applications (admin only)
router.get('/', adminAuth, async (req, res) => {
    try {
        const { status } = req.query;
        let filter = {};
        
        if (status) {
            filter.status = status;
        }

        const leaves = await Leave.find(filter)
            .populate('staff', 'name email role phone')
            .populate('processedBy', 'name email')
            .sort({ createdAt: -1 });
        
        res.json(leaves);
    } catch (error) {
        console.error('Get all leave error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update leave status (admin only)
router.patch('/:id/status', adminAuth, async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        
        if (!['approved', 'rejected', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const leave = await Leave.findById(req.params.id).populate('staff');
        
        if (!leave) {
            return res.status(404).json({ message: 'Leave application not found' });
        }

        // Update leave days if approved/rejected
        if (status === 'approved' && leave.status !== 'approved') {
            await updateLeaveBalance(leave.staff, leave.leaveType, -leave.days);
        } else if (status === 'rejected' && leave.status === 'approved') {
            await updateLeaveBalance(leave.staff, leave.leaveType, leave.days);
        }

        leave.status = status;
        leave.adminNotes = adminNotes;
        leave.processedBy = req.user._id;
        leave.processedAt = new Date();

        await leave.save();
        res.json(leave);
    } catch (error) {
        console.error('Update leave status error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Cancel own leave application
router.patch('/:id/cancel', auth, async (req, res) => {
    try {
        const leave = await Leave.findOne({ 
            _id: req.params.id, 
            staff: req.user._id 
        });

        if (!leave) {
            return res.status(404).json({ message: 'Leave application not found' });
        }

        if (leave.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending leave applications can be cancelled' });
        }

        leave.status = 'cancelled';
        await leave.save();

        res.json(leave);
    } catch (error) {
        console.error('Cancel leave error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get leave statistics for staff
router.get('/stats', auth, async (req, res) => {
    try {
        const staff = await User.findById(req.user._id);
        const currentYear = new Date().getFullYear();

        const leaveStats = await Leave.aggregate([
            {
                $match: {
                    staff: req.user._id,
                    startDate: { $gte: new Date(`${currentYear}-01-01`) },
                    endDate: { $lte: new Date(`${currentYear}-12-31`) },
                    status: 'approved'
                }
            },
            {
                $group: {
                    _id: '$leaveType',
                    totalDays: { $sum: '$days' }
                }
            }
        ]);

        // Initialize leave balances
        const stats = {
            annualLeave: {
                allocated: staff.leaveBalance?.annual || 21,
                used: 0,
                remaining: staff.leaveBalance?.annual || 21
            },
            sickLeave: {
                allocated: staff.leaveBalance?.sick || 10,
                used: 0,
                remaining: staff.leaveBalance?.sick || 10
            },
            familyResponsibility: {
                allocated: staff.leaveBalance?.family || 3,
                used: 0,
                remaining: staff.leaveBalance?.family || 3
            },
            summary: {
                pending: 0,
                approved: 0,
                rejected: 0
            }
        };

        // Calculate used leave days from approved leaves
        leaveStats.forEach(stat => {
            if (stat._id === 'annual') {
                stats.annualLeave.used = stat.totalDays;
                stats.annualLeave.remaining = stats.annualLeave.allocated - stat.totalDays;
            } else if (stat._id === 'sick') {
                stats.sickLeave.used = stat.totalDays;
                stats.sickLeave.remaining = stats.sickLeave.allocated - stat.totalDays;
            } else if (stat._id === 'family') {
                stats.familyResponsibility.used = stat.totalDays;
                stats.familyResponsibility.remaining = stats.familyResponsibility.allocated - stat.totalDays;
            }
        });

        // Get count of applications by status
        const statusCounts = await Leave.aggregate([
            {
                $match: {
                    staff: req.user._id,
                    createdAt: { $gte: new Date(`${currentYear}-01-01`) }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        statusCounts.forEach(stat => {
            if (stat._id === 'pending') stats.summary.pending = stat.count;
            if (stat._id === 'approved') stats.summary.approved = stat.count;
            if (stat._id === 'rejected') stats.summary.rejected = stat.count;
        });

        res.json(stats);
    } catch (error) {
        console.error('Get leave stats error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Helper functions
function calculateWorkingDays(start, end) {
    let days = 0;
    const current = new Date(start);
    
    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude weekends
            days++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    return days;
}

function getAvailableLeave(staff, leaveType) {
    return staff.leaveBalance?.[leaveType] || 0;
}

async function updateLeaveBalance(staffId, leaveType, days) {
    const staff = await User.findById(staffId);
    if (!staff.leaveBalance) {
        staff.leaveBalance = {
            annual: 21,
            sick: 10,
            family: 3
        };
    }
    staff.leaveBalance[leaveType] += days;
    await staff.save();
}

module.exports = router;