const express = require('express');
const router = express.Router();
const Prompt = require('../models/Prompt');

const auth = require('../middleware/auth');

// GET all prompts
router.get('/', auth, async (req, res) => {
    try {
        const prompts = await Prompt.find({ userId: req.userId });
        res.json(prompts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST/PUT (Upsert) prompt
router.post('/', auth, async (req, res) => {
    try {
        const promptData = { ...req.body, userId: req.userId };
        const prompt = await Prompt.findOneAndUpdate(
            { id: promptData.id, userId: req.userId },
            promptData,
            { new: true, upsert: true }
        );
        res.json(prompt);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE prompt
router.delete('/:id', auth, async (req, res) => {
    try {
        const prompt = await Prompt.findOneAndDelete({ id: req.params.id, userId: req.userId });
        if (!prompt) {
            return res.status(404).json({ message: 'Prompt not found' });
        }
        res.json({ message: 'Prompt deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
