const { Schema, model } = require('mongoose');

const rodSchema = new Schema({
  id: String,
  name: String,
  qualityPercent: { type: Number, default: 0 },
  durability: { type: Number, default: 0 },
  maxDurability: { type: Number, default: 0 },
});

const baitSchema = new Schema({
  id: String,
  name: String,
  bonusPercent: { type: Number, default: 0 },
  quantity: { type: Number, default: 0 },
});

const fishItemSchema = new Schema({
  id: String,
  name: String,
  locationId: String,
  rarity: { type: String, default: 'Common' },
  sizeLbs: Number,
  sizeIn: Number,
  price: Number,
  thumbnail: String,
  emoji: { type: String, default: null },
  variant: { type: String, default: null },
  caughtAt: { type: Date, default: Date.now }
});

const fishing = new Schema({
  guild: String,
  user: String,
  rods: [rodSchema],
  baits: [baitSchema],
  selectedRodId: { type: String, default: null },
  selectedBaitId: { type: String, default: null },
  locationId: { type: String, default: null },
  travelEndAt: { type: Date, default: null },
  lastCastAt: { type: Date, default: null },
  bucket: [fishItemSchema],
});

fishing.index({ guild: 1, user: 1 }, { unique: true });

module.exports = model('fishings', fishing); 