const { Schema, model } = require('mongoose');

// โครงสร้าง Inventory ที่มีประสิทธิภาพ
const InventoryOptimized = Schema({
    guild: { type: String, required: true, index: true },
    user: { type: String, required: true, index: true },
    
    // จัดกลุ่ม items ตาม type เพื่อ query ได้เร็วขึ้น
    items: {
        furniture: {
            type: Map,
            of: {
                name: String,
                quantity: { type: Number, default: 1 },
                area: Number,
                level: Number,
                lastUsed: { type: Date, default: Date.now }
            },
            default: new Map()
        },
        wallpaper: {
            type: Map,
            of: {
                name: String,
                quantity: { type: Number, default: 1 },
                side: String, // left, right, both
                level: Number,
                lastUsed: { type: Date, default: Date.now }
            },
            default: new Map()
        },
        floor: {
            type: Map,
            of: {
                name: String,
                quantity: { type: Number, default: 1 },
                level: Number,
                lastUsed: { type: Date, default: Date.now }
            },
            default: new Map()
        },
        food: {
            type: Map,
            of: {
                name: String,
                quantity: { type: Number, default: 1 },
                exp: Number,
                feed: Number,
                lastUsed: { type: Date, default: Date.now }
            },
            default: new Map()
        }
    },
    
    // เก็บสถิติการใช้งาน
    stats: {
        totalItems: { type: Number, default: 0 },
        lastItemAdded: { type: Date, default: Date.now },
        mostUsedType: { type: String, default: 'furniture' }
    },
    
    // Metadata
    lastModified: { type: Date, default: Date.now },
    version: { type: Number, default: 1 }
});

// เพิ่ม indexes
InventoryOptimized.index({ guild: 1, user: 1 }, { unique: true });
InventoryOptimized.index({ 'stats.lastItemAdded': -1 }); // สำหรับ recent items

// Middleware
InventoryOptimized.pre('save', function(next) {
    this.lastModified = new Date();
    this.updateStats();
    next();
});

// Static methods
InventoryOptimized.statics.findUserInventory = function(guild, user) {
    return this.findOne({ guild, user });
};

InventoryOptimized.statics.getItemsByType = function(guild, user, type) {
    return this.findOne({ guild, user }, `items.${type}`);
};

// Instance methods
InventoryOptimized.methods.addItem = function(type, itemId, itemData, quantity = 1) {
    if (!this.items[type]) {
        return { success: false, message: `Invalid item type: ${type}` };
    }
    
    const existingItem = this.items[type].get(itemId);
    if (existingItem) {
        // เพิ่มจำนวน
        existingItem.quantity += quantity;
        existingItem.lastUsed = new Date();
        this.items[type].set(itemId, existingItem);
    } else {
        // เพิ่ม item ใหม่
        this.items[type].set(itemId, {
            ...itemData,
            quantity: quantity,
            lastUsed: new Date()
        });
    }
    
    return { success: true, message: "Item added successfully" };
};

InventoryOptimized.methods.removeItem = function(type, itemId, quantity = 1) {
    if (!this.items[type]) {
        return { success: false, message: `Invalid item type: ${type}` };
    }
    
    const item = this.items[type].get(itemId);
    if (!item) {
        return { success: false, message: "Item not found" };
    }
    
    if (item.quantity <= quantity) {
        // ลบ item ทั้งหมด
        this.items[type].delete(itemId);
    } else {
        // ลดจำนวน
        item.quantity -= quantity;
        this.items[type].set(itemId, item);
    }
    
    return { success: true, message: "Item removed successfully" };
};

InventoryOptimized.methods.getItemsByType = function(type) {
    if (!this.items[type]) return new Map();
    return this.items[type];
};

InventoryOptimized.methods.findItem = function(itemId) {
    // ค้นหา item ใน type ทั้งหมด
    for (const [type, items] of Object.entries(this.items)) {
        if (items.has && items.has(itemId)) {
            return { type, item: items.get(itemId) };
        }
    }
    return null;
};

InventoryOptimized.methods.updateStats = function() {
    let totalItems = 0;
    let typeUsage = {};
    
    for (const [type, items] of Object.entries(this.items)) {
        if (items.size) {
            const typeCount = Array.from(items.values()).reduce((sum, item) => sum + item.quantity, 0);
            totalItems += typeCount;
            typeUsage[type] = typeCount;
        }
    }
    
    this.stats.totalItems = totalItems;
    this.stats.mostUsedType = Object.keys(typeUsage).reduce((a, b) => 
        typeUsage[a] > typeUsage[b] ? a : b, 'furniture'
    );
};

// Virtual สำหรับ backward compatibility
InventoryOptimized.virtual('item').get(function() {
    // แปลงเป็น array format เก่าสำหรับ compatibility
    const items = [];
    for (const [type, itemMap] of Object.entries(this.items)) {
        if (itemMap.size) {
            for (const [id, itemData] of itemMap) {
                for (let i = 0; i < itemData.quantity; i++) {
                    items.push({
                        id: `${id}_${i}`,
                        type: type,
                        ...itemData
                    });
                }
            }
        }
    }
    return items;
});

module.exports = model('inventorys_optimized', InventoryOptimized); 