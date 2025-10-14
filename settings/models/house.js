const { Schema, model } = require('mongoose');

const Create = Schema({
    guild: String,
    user: String,
    house: String,
    houseHash: String,
    /// Furniture
    A_DATA: {
        A1: Boolean,
        A1I: String,
        A1D: Boolean,
        ///
        A2: Boolean,
        A2I: String,
        A2D: Boolean,
        ///
        A3: Boolean,
        A3I: String,
        A3D: Boolean,
        ///
        A4: Boolean,
        A4I: String,
        A4D: Boolean
    },
    /// Furniture
    B_DATA: {
        B1: Boolean,
        B1I: String,
        B1D: Boolean,
        ///
        B2: Boolean,
        B2I: String,
        B2D: Boolean,
        ///
        B3: Boolean,
        B3I: String,
        B3D: Boolean,
        ///
        B4: Boolean,
        B4I: String,
        B4D: Boolean
    },
    /// Furniture
    C_DATA: {
        C1: Boolean,
        C1I: String,
        C1D: Boolean,
        ///
        C2: Boolean,
        C2I: String,
        C2D: Boolean,
        ///
        C3: Boolean,
        C3I: String,
        C3D: Boolean,
        ///
        C4: Boolean,
        C4I: String,
        C4D: Boolean
    },
    /// Furniture
    D_DATA: {
        D1: Boolean,
        D1I: String,
        D1D: Boolean,
        ///
        D2: Boolean,
        D2I: String,
        D2D: Boolean,
        ///
        D3: Boolean,
        D3I: String,
        D3D: Boolean,
        ///
        D4: Boolean,
        D4I: String,
        D4D: Boolean
    },
    /// Floor
    FLOOR_DATA: {
        FLOOR: Boolean,
        FLOORI: String,
        FLOORD: Boolean
    },
    // Tile layer
    TILE_DATA: {
        TILE: Boolean,
        TILEI: String
    },
    /// Wallpapers
    WALL_DATA: {
        L1: Boolean,
        L1I: String,
        L1D: Boolean,
        ///
        L2: Boolean,
        L2I: String,
        L2D: Boolean,
        ///
        L3: Boolean,
        L3I: String,
        L3D: Boolean,
        ///
        L4: Boolean,
        L4I: String,
        L4D: Boolean,
        ///
        R1: Boolean,
        R1I: String,
        R1D: Boolean,
        ///
        R2: Boolean,
        R2I: String,
        R2D: Boolean,
        ///
        R3: Boolean,
        R3I: String,
        R3D: Boolean,
        ///
        R4: Boolean,
        R4I: String,
        R4D: Boolean,
    },
    /// Poop System - เก็บข้อมูล poop ในแต่ละสล็อต
    POOP_DATA: {
        A1: { type: Boolean, default: false },
        A2: { type: Boolean, default: false },
        A3: { type: Boolean, default: false },
        A4: { type: Boolean, default: false },
        B1: { type: Boolean, default: false },
        B2: { type: Boolean, default: false },
        B3: { type: Boolean, default: false },
        B4: { type: Boolean, default: false },
        C1: { type: Boolean, default: false },
        C2: { type: Boolean, default: false },
        C3: { type: Boolean, default: false },
        C4: { type: Boolean, default: false },
        D1: { type: Boolean, default: false },
        D2: { type: Boolean, default: false },
        D3: { type: Boolean, default: false },
        D4: { type: Boolean, default: false }
    }
});

// เพิ่ม compound index สำหรับการค้นหาเอกสารบ้านของผู้ใช้ในกิลด์
Create.index({ guild: 1, user: 1 }, { unique: true });

module.exports = model('houses', Create);

