const mongoose = require('mongoose');

const PromptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    template: { type: String, required: true },
    category: {
        type: String,
        enum: ['general', 'drafting', 'refining', 'brainstorm', 'character', 'world', 'outline', 'beats'],
        required: true
    },
    isBuiltIn: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false }
}, {
    timestamps: true
});

PromptSchema.index({ userId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model('Prompt', PromptSchema);
