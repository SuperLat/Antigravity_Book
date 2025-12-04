const express = require('express');
const router = express.Router();
const Idea = require('../models/Idea');

const auth = require('../middleware/auth');

// GET all ideas
router.get('/', auth, async (req, res) => {
    try {
        const ideas = await Idea.find({ userId: req.userId });
        res.json(ideas);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST/PUT (Upsert) idea
router.post('/', auth, async (req, res) => {
    try {
        const ideaData = { ...req.body, userId: req.userId };
        const idea = await Idea.findOneAndUpdate(
            { id: ideaData.id, userId: req.userId },
            ideaData,
            { new: true, upsert: true }
        );
        res.json(idea);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE idea
router.delete('/:id', auth, async (req, res) => {
    try {
        const idea = await Idea.findOneAndDelete({ id: req.params.id, userId: req.userId });
        if (!idea) {
            return res.status(404).json({ message: 'Idea not found' });
        }
        res.json({ message: 'Idea deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
