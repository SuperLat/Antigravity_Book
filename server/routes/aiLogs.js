const express = require('express');
const router = express.Router();
const AILog = require('../models/AILog');
const auth = require('../middleware/auth');

// GET logs (paginated)
router.get('/', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const query = { userId: req.userId };

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
            totalLogs: total
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

module.exports = router;
