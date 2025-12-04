const mongoose = require('mongoose');

const ChapterSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    summary: { type: String, default: '' }
});

const EntitySchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: { type: String, enum: ['CHARACTER', 'WORLDVIEW', 'PLOT', 'IDEA'], required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    tags: [String],
    content: { type: String, default: '' }
});

const BookSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    id: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, default: '' },
    description: { type: String, default: '' },
    status: { type: String, enum: ['serializing', 'completed'], default: 'serializing' },
    cover: { type: String, default: '' },
    chapters: [ChapterSchema],
    entities: [EntitySchema]
}, {
    timestamps: true
});

// Create compound index for userId + id
BookSchema.index({ userId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Book', BookSchema);
