const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: '未授权，请先登录' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;

        next();
    } catch (error) {
        res.status(401).json({ message: 'Token 无效或已过期' });
    }
};

module.exports = auth;
