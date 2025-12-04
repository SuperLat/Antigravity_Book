const mongoose = require('mongoose');

const ChapterBeatSchema = new mongoose.Schema({
    chapterTitle: { type: String, required: true },
    summary: { type: String, required: true },
    keyCharacters: [String],
    conflict: { type: String, required: true }
});

const IdeaSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    id: { type: String, required: true },
    title: { type: String, required: true },
    spark: { type: String, default: '' },
    worldview: { type: String, default: '' },
    outline: { type: String, default: '' },
    chapterBeats: [ChapterBeatSchema],
    updatedAt: { type: Number, required: true }
}, {
    timestamps: true
});

IdeaSchema.index({ userId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Idea', IdeaSchema);
