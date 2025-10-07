const { Schema, model } = require('mongoose');

const guildState = Schema({
    guild: { type: String, unique: true, index: true },
    baccaratHistory: { type: [String], default: [] }, // stores 'B' or 'P'
});

module.exports = model('guild_states', guildState);



