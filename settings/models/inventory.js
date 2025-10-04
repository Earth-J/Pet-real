const { Schema, model } = require('mongoose');

const inventory = Schema({
    guild: String,
    user: String,
    item: Array,
});

// เพิ่ม index เพื่อให้การค้นหา inventory ต่อผู้ใช้ในกิลด์เร็วขึ้น
inventory.index({ guild: 1, user: 1 }, { unique: true });

module.exports = model('inventorys', inventory);

