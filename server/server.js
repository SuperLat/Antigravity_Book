require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large chapter content
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/books', require('./routes/books'));
app.use('/api/prompts', require('./routes/prompts'));
app.use('/api/ideas', require('./routes/ideas'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/ai-logs', require('./routes/aiLogs'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Generic Proxy Route to bypass CORS
app.post('/api/proxy', async (req, res) => {
    try {
        const { targetUrl, method = 'POST', headers = {}, body } = req.body;

        if (!targetUrl) {
            return res.status(400).json({ message: 'Missing targetUrl' });
        }

        // Filter out headers that shouldn't be forwarded or might cause issues
        const forwardHeaders = { ...headers };
        delete forwardHeaders['host'];
        delete forwardHeaders['content-length'];
        delete forwardHeaders['origin'];
        delete forwardHeaders['referer'];

        const response = await fetch(targetUrl, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...forwardHeaders
            },
            body: JSON.stringify(body)
        });

        const data = await response.text();

        // Try to parse JSON if possible
        try {
            const jsonData = JSON.parse(data);
            res.status(response.status).json(jsonData);
        } catch (e) {
            res.status(response.status).send(data);
        }

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ message: `Proxy Error: ${error.message}` });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
