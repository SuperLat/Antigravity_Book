const express = require('express');
const router = express.Router();
const Book = require('../models/Book');

const auth = require('../middleware/auth');

// GET all books
router.get('/', auth, async (req, res) => {
    try {
        const books = await Book.find({ userId: req.userId });
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET single book
router.get('/:id', auth, async (req, res) => {
    try {
        const book = await Book.findOne({ id: req.params.id, userId: req.userId });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.json(book);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST/PUT (Upsert) book
router.post('/', auth, async (req, res) => {
    try {
        const bookData = { ...req.body, userId: req.userId };
        const book = await Book.findOneAndUpdate(
            { id: bookData.id, userId: req.userId },
            bookData,
            { new: true, upsert: true }
        );
        res.json(book);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE book
router.delete('/:id', auth, async (req, res) => {
    try {
        const book = await Book.findOneAndDelete({ id: req.params.id, userId: req.userId });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        res.json({ message: 'Book deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
