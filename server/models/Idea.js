const mongoose = require('mongoose');

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
    beats: [String], // 简化为字符串数组
    createdAt: { type: Number, required: true }
});

const CharacterProfileSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    gender: { type: String },
    age: { type: String },
    description: { type: String },
    background: { type: String },
    personality: { type: String },
    appearance: { type: String }
});

const GenerationHistoryEntrySchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: { type: String, required: true },
    content: { type: String, required: true },
    prompt: { type: String },
    model: { type: String, required: true },
    createdAt: { type: Number, required: true }
});

const IdeaSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    id: { type: String, required: true },
    title: { type: String, required: true },
    spark: { type: String, default: '' },
    storyCore: { type: String }, // Added
    storySynopsis: { type: String }, // Added
    storyLength: { type: String }, // Added
    storyGenre: { type: String }, // Added
    storyBackground: { type: String }, // Added
    storyline: { type: String, default: '' }, // Added
    worldview: { type: String, default: '' },
    characters: [CharacterProfileSchema], // Added
    outline: { type: String, default: '' },
    volumes: [VolumeSchema], // Added
    chapterBeats: [String], // 简化为字符串数组
    beatsSplitHistory: [BeatsSplitSchema], // Added
    lastSplitChapterNum: { type: Number, default: 0 }, // Added
    linkedBookId: { type: String }, // Added
    generationHistory: [GenerationHistoryEntrySchema], // Added
}, {
    timestamps: true
});

IdeaSchema.index({ userId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Idea', IdeaSchema);
