const mongoose = require('mongoose');

const AILogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookId: { type: String }, // Optional, string ID from frontend
    actionType: { type: String, required: true }, // e.g., 'chat', 'summary', 'worldview'
    category: { type: String }, // e.g., 'drafting', 'character', 'refining'
    prompt: { type: String, required: true },
    response: { type: String, required: true },
    modelName: { type: String },
    timestamp: { type: Date, default: Date.now }
});

// Index for fast retrieval by user and time
AILogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AILog', AILogSchema);
