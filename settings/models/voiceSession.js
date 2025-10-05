const { Schema, model } = require('mongoose');

const voiceSession = Schema({
    guild: { type: String, index: true },
    user: { type: String, index: true },
    joinTime: { type: Date, required: true },
});

voiceSession.index({ guild: 1, user: 1 }, { unique: true });

module.exports = model('voice_sessions', voiceSession);




