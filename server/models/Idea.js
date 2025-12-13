const mongoose = require('mongoose');

const ChapterBeatSchema = new mongoose.Schema({
    chapterTitle: { type: String, required: true },
    summary: { type: String, required: true },
    keyCharacters: [String],
    conflict: { type: String, required: true }
});

const PartSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    order: { type: Number, required: true }
});

const VolumeSchema = new mongoose.Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    order: { type: Number, required: true },
    parts: [PartSchema]
});

const BeatsSplitSchema = new mongoose.Schema({
    id: { type: String, required: true },
    volumeContent: { type: String, required: true },
    chapterCount: { type: Number, required: true },
    startChapter: { type: Number, required: true },
    beats: [ChapterBeatSchema],
    createdAt: { type: Number, required: true }
});

const IdeaSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    id: { type: String, required: true },
    title: { type: String, required: true },
    spark: { type: String, default: '' },
    storyline: { type: String, default: '' }, // Added
    worldview: { type: String, default: '' },
    outline: { type: String, default: '' },
    volumes: [VolumeSchema], // Added
    chapterBeats: [ChapterBeatSchema],
    beatsSplitHistory: [BeatsSplitSchema], // Added
    lastSplitChapterNum: { type: Number, default: 0 }, // Added
    linkedBookId: { type: String }, // Added
    updatedAt: { type: Number, required: true }
}, {
    timestamps: true
});

IdeaSchema.index({ userId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Idea', IdeaSchema);
