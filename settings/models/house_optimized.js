const { Schema, model } = require('mongoose');

// โครงสร้างใหม่ที่มีประสิทธิภาพมากกว่า
const HouseOptimized = Schema({
    guild: { type: String, required: true, index: true },
    user: { type: String, required: true, index: true },
    
    // ใช้ Map แทน nested objects เพื่อความยืดหยุ่น
    furniture: {
        type: Map,
        of: {
            itemName: String,
            area: Number,  // พื้นที่ที่ครอบครอง
            placed: { type: Boolean, default: true }
        },
        default: new Map()
    },
    
    // แยก wallpaper เป็น left และ right
    wallpaper: {
        left: {
            type: Map,
            of: {
                itemName: String,
                area: Number,
                placed: { type: Boolean, default: true }
            },
            default: new Map()
        },
        right: {
            type: Map,
            of: {
                itemName: String,
                area: Number,
                placed: { type: Boolean, default: true }
            },
            default: new Map()
        }
    },
    
    // Floor ง่ายขึ้น
    floor: {
        itemName: String,
        placed: { type: Boolean, default: false }
    },
    
    // เก็บข้อมูลการจัดวางแบบ grid
    layout: {
        grid: {
            type: [[String]], // 2D array เก็บตำแหน่ง items
            default: () => Array(4).fill().map(() => Array(4).fill(null))
        },
        maxSlots: { type: Number, default: 16 }
    },
    
    // Metadata สำหรับ optimization
    lastModified: { type: Date, default: Date.now },
    version: { type: Number, default: 1 }
});

// เพิ่ม compound index สำหรับ query ที่ใช้บ่อย
HouseOptimized.index({ guild: 1, user: 1 }, { unique: true });

// เพิ่ม middleware สำหรับ auto-update lastModified
HouseOptimized.pre('save', function(next) {
    this.lastModified = new Date();
    next();
});

// Static methods สำหรับการใช้งานทั่วไป
HouseOptimized.statics.findUserHouse = function(guild, user) {
    return this.findOne({ guild, user });
};

HouseOptimized.statics.createOrUpdateHouse = function(guild, user, data) {
    return this.findOneAndUpdate(
        { guild, user },
        { ...data, lastModified: new Date() },
        { upsert: true, new: true }
    );
};

// Instance methods สำหรับจัดการ furniture
HouseOptimized.methods.placeFurniture = function(position, itemName, area = 1) {
    // ตรวจสอบว่าตำแหน่งว่างหรือไม่
    const [row, col] = this.parsePosition(position);
    if (!this.isPositionAvailable(row, col, area)) {
        return { success: false, message: "Position not available" };
    }
    
    // วาง furniture
    this.furniture.set(position, { itemName, area, placed: true });
    this.updateGrid(row, col, area, itemName);
    
    return { success: true, message: "Furniture placed successfully" };
};

HouseOptimized.methods.removeFurniture = function(position) {
    const furniture = this.furniture.get(position);
    if (!furniture) return { success: false, message: "No furniture at this position" };
    
    const [row, col] = this.parsePosition(position);
    this.clearGrid(row, col, furniture.area);
    this.furniture.delete(position);
    
    return { success: true, message: "Furniture removed successfully" };
};

HouseOptimized.methods.parsePosition = function(position) {
    // แปลง A1, B2 เป็น [row, col]
    const row = position.charAt(0).charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
    const col = parseInt(position.charAt(1)) - 1; // 1=0, 2=1, 3=2, 4=3
    return [row, col];
};

HouseOptimized.methods.isPositionAvailable = function(row, col, area) {
    // ตรวจสอบว่าพื้นที่เพียงพอหรือไม่
    for (let i = 0; i < area; i++) {
        if (row + i >= 4 || col >= 4) return false;
        if (this.layout.grid[row + i][col] !== null) return false;
    }
    return true;
};

HouseOptimized.methods.updateGrid = function(row, col, area, itemName) {
    for (let i = 0; i < area; i++) {
        if (row + i < 4) {
            this.layout.grid[row + i][col] = itemName;
        }
    }
};

HouseOptimized.methods.clearGrid = function(row, col, area) {
    for (let i = 0; i < area; i++) {
        if (row + i < 4) {
            this.layout.grid[row + i][col] = null;
        }
    }
};

module.exports = model('houses_optimized', HouseOptimized); 