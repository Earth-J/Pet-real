const { Schema, model } = require('mongoose');

const profile = Schema({
    guild: String,
    user: String,
    level: Number,
    money: Number,
    tokens: {
        type: Number,
        default: 0
    },
    bank: {
        type: Number,
        default: 0
    },
    inventory: {
        type: Number,
        default: 100
    },
    baccarat: {
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        ties: { type: Number, default: 0 },
        rounds: { type: Number, default: 0 },
        net: { type: Number, default: 0 }
    }
});

profile.index({ guild: 1, user: 1 }, { unique: true });

module.exports = model('profiles', profile);
