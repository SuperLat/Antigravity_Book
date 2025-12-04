const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    settings: { type: mongoose.Schema.Types.Mixed, required: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('Settings', SettingsSchema);
