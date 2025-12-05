const express = require('express');
const router = express.Router();
const AILog = require('../models/AILog');
const auth = require('../middleware/auth');

// Clean up logs older than 7 days
const cleanupOldLogs = async (userId) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
        const result = await AILog.deleteMany({
            userId: userId,
            timestamp: { $lt: sevenDaysAgo }
        });
        if (result.deletedCount > 0) {
            console.log(`Cleaned up ${result.deletedCount} old logs for user ${userId}`);
        }
    } catch (error) {
        console.error('Error cleaning up old logs:', error);
    }
};

// GET logs (paginated)
router.get('/', auth, async (req, res) => {
    try {
        // Clean up old logs first
        await cleanupOldLogs(req.userId);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Only get logs from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const query = {
            userId: req.userId,
            timestamp: { $gte: sevenDaysAgo }
        };

        // Optional filtering
        if (req.query.category) {
            query.category = req.query.category;
        }
        if (req.query.actionType) {
            query.actionType = req.query.actionType;
        }

        const logs = await AILog.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await AILog.countDocuments(query);

        res.json({
            logs,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            total: total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST log
router.post('/', auth, async (req, res) => {
    try {
        const log = new AILog({
            ...req.body,
            userId: req.userId
        });
        await log.save();
        res.status(201).json(log);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE log (optional cleanup)
router.delete('/:id', auth, async (req, res) => {
    try {
        await AILog.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        res.json({ message: 'Log deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// DELETE all old logs (manual cleanup endpoint)
router.delete('/cleanup/old', auth, async (req, res) => {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const result = await AILog.deleteMany({
            userId: req.userId,
            timestamp: { $lt: sevenDaysAgo }
        });

        res.json({
            message: `Deleted ${result.deletedCount} old logs`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
