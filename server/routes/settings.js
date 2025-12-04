const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

const auth = require('../middleware/auth');

// GET settings
router.get('/', auth, async (req, res) => {
    try {
        const settings = await Settings.findOne({ userId: req.userId });
        if (!settings) {
            return res.json(null);
        }
        res.json(settings.settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST/PUT settings
router.post('/', auth, async (req, res) => {
    try {
        const settingsData = req.body;
        const settings = await Settings.findOneAndUpdate(
            { userId: req.userId },
            { settings: settingsData, userId: req.userId },
            { new: true, upsert: true }
        );
        res.json(settings.settings);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
