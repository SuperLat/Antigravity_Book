const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Initialize default admin user
const initAdmin = async () => {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const admin = new User({
                username: 'admin',
                email: 'admin@novelcraft.com',
                password: 'admin' // Will be hashed by pre-save hook
            });
            await admin.save();
            console.log('Default admin account created');
        }
    } catch (error) {
        console.error('Failed to create admin account:', error);
    }
};

initAdmin();

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: '用户名或邮箱已存在' });
        }

        // Create user
        const user = new User({ username, email, password });
        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // identifier can be email or username

        // Find user by email OR username
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { username: identifier }
            ]
        });

        if (!user) {
            return res.status(401).json({ message: '账号或密码错误' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: '账号或密码错误' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: '未授权' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }

        res.json(user);
    } catch (error) {
        res.status(401).json({ message: 'Token 无效' });
    }
});

module.exports = router;
