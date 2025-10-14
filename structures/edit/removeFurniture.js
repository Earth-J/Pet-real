const defaults = require("../../settings/default.js");

function findItemDefByName(name) {
    // ตรวจสอบว่า defaults มีอยู่และมี properties ที่ต้องการ
    if (!defaults) return null;
    
    // ค้นหาใน furniture
    if (defaults.furniture && Array.isArray(defaults.furniture)) {
        let item = defaults.furniture.find(x => x.name === name);
        if (item) return { ...item };
    }
    
    // ค้นหาใน wallpaper (ถ้ามี)
    if (defaults.wallpaper && Array.isArray(defaults.wallpaper)) {
        let item = defaults.wallpaper.find(x => x.name === name);
        if (item) return { ...item };
    }
    
    // ค้นหาใน floor
    if (defaults.floor && Array.isArray(defaults.floor)) {
        let item = defaults.floor.find(x => x.name === name);
        if (item) return { ...item };
    }
    
    // ค้นหาใน tile
    if (defaults.tile && Array.isArray(defaults.tile)) {
        let item = defaults.tile.find(x => x.name === name);
        if (item) return { ...item };
    }
    
    return null;
}

function generateID() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

async function returnItemToInventory(inv, name, hintType) {
    // ลบ _right และ _left ออกจากชื่อเฟอร์นิเจอร์ก่อนค้นหา definition
    const cleanName = name.replace(/_right$|_left$/, '');
    const def = findItemDefByName(cleanName) || { name: cleanName, type: hintType, price: 0, level: 1 };
    const payload = { name: def.name, type: def.type, price: def.price || 0, level: def.level || 1, id: generateID() };
    if (def.type === 'furniture') payload.area = def.area || 1;
    if (def.type === 'wallpaper') payload.side = def.side || undefined;
    if (def.emoji) payload.emoji = def.emoji;
    inv.item.push(payload);
}

function buildRemoveOptions(home) {
    const opts = [];
    const rows = ['A','B','C','D'];
    const processedSlots = new Set(); // เก็บช่องที่ประมวลผลแล้ว
    
    for (const r of rows) {
        for (let c = 1; c <= 4; c++) {
            const slotKey = `${r}${c}`;
            
            // ข้ามถ้าช่องนี้ถูกประมวลผลแล้ว (เป็นส่วนหนึ่งของ 2x2 ที่ประมวลผลไปแล้ว)
            if (processedSlots.has(slotKey)) continue;
            
            const itemName = home[`${r}_DATA`][`${r}${c}I`];
            if (!itemName || itemName === "OCCUPIED") continue; // เฉพาะช่องที่มีของ และไม่ใช่ secondary slot ของ 2x2
            
            const def = findItemDefByName(itemName);
            // ตรวจสอบว่าเป็นเฟอร์นิเจอร์เท่านั้น (ไม่รวมพื้น)
            if (def && def.type !== 'furniture') continue;
            
            // ลบ _right และ _left ออกจากชื่อเฟอร์นิเจอร์
            const cleanItemName = itemName.replace(/_right$|_left$/, '');
            
            let label;
            let is2x2Furniture = false;
            let secondSlot = null;
            
            // ตรวจสอบว่าเป็นเฟอร์นิเจอร์ 2x2 หรือไม่
            // สำหรับ 2x2 furniture, secondary slot จะมีค่า "OCCUPIED"
            // ตรวจสอบแนวนอนก่อน (A1-A2, B1-B2, C1-C2, D1-D2)
            if (c < 4) {
                const nextCol = c + 1;
                const nextSlotKey = `${r}${nextCol}`;
                const nextItemName = home[`${r}_DATA`][`${r}${nextCol}I`];
                // เช็คว่า secondary slot เป็น "OCCUPIED" (สำหรับ 2x2 horizontal)
                if (nextItemName === "OCCUPIED") {
                    is2x2Furniture = true;
                    secondSlot = nextSlotKey;
                    label = `${r}${c}-${r}${nextCol} • ${cleanItemName}`;
                }
            }
            
            // ถ้าไม่เจอแนวนอน ลองตรวจสอบแนวตั้ง (A1-B1, B1-C1, C1-D1)
            if (!is2x2Furniture) {
                const nextRow = String.fromCharCode(r.charCodeAt(0) + 1);
                const nextSlotKey = `${nextRow}${c}`;
                if (home[`${nextRow}_DATA`]) {
                    const nextItemName = home[`${nextRow}_DATA`][`${nextRow}${c}I`];
                    // เช็คว่า secondary slot เป็น "OCCUPIED" (สำหรับ 2x2 vertical)
                    if (nextItemName === "OCCUPIED") {
                        is2x2Furniture = true;
                        secondSlot = nextSlotKey;
                        label = `${r}${c}-${nextRow}${c} • ${cleanItemName}`;
                    }
                }
            }
            
            // ถ้าไม่ใช่ 2x2 ให้ใช้ label แบบธรรมดา
            if (!is2x2Furniture) {
                label = `${r}${c} • ${cleanItemName}`;
            }
            
            // เพิ่ม option
            opts.push({ label: `ถอด ${label}`, value: `rm:${r}${c}` });
            
            // mark ช่องที่ประมวลผลแล้ว
            processedSlots.add(slotKey);
            if (secondSlot) {
                processedSlots.add(secondSlot);
            }
        }
    }
    
    return opts.slice(0, 25);
}

async function removeFurnitureSlot(home, inv, row, col) {
    const keyFlag = `${row}${col}`;
    const keyItem = `${row}${col}I`;
    let itemName = home[`${row}_DATA`][keyItem];
    
    if (!itemName) return false;
    
    // ถ้าเป็น "OCCUPIED" แสดงว่านี่คือ secondary slot ของ 2x2 furniture
    // ไม่ควรถูกเรียกที่นี่ แต่ถ้าถูกเรียก ให้ return false เพื่อไม่คืนเฟอร์นิเจอร์
    if (itemName === "OCCUPIED") {
        console.log(`⚠️ removeFurnitureSlot called on secondary slot ${row}${col} with "OCCUPIED"`);
        return false;
    }
    
    const def = findItemDefByName(itemName);
    // คืนเฟอร์นิเจอร์ให้ inventory (1 ชิ้นเท่านั้น)
    await returnItemToInventory(inv, itemName, 'furniture');
    
    // ตรวจสอบว่าเป็นเฟอร์นิเจอร์ 2x2 หรือไม่
    // สำหรับ 2x2 furniture, secondary slot จะมีค่า "OCCUPIED"
    let is2x2Horizontal = false; // แนวนอน (A1-A2, B1-B2, C1-C2, D1-D2)
    let is2x2Vertical = false; // แนวตั้ง (A1-B1, B1-C1, C1-D1)
    
    // ตรวจสอบแนวนอนก่อน (ทุกแถว)
    if (col < 4) {
        const nextCol = col + 1;
        const nextItemName = home[`${row}_DATA`][`${row}${nextCol}I`];
        // เช็คว่า secondary slot เป็น "OCCUPIED" (สำหรับ 2x2 horizontal)
        if (nextItemName === "OCCUPIED") {
            is2x2Horizontal = true;
        }
    }
    
    // ถ้าไม่เจอแนวนอน ลองตรวจสอบแนวตั้ง (ทุกแถวยกเว้น D)
    if (!is2x2Horizontal) {
        const nextRow = String.fromCharCode(row.charCodeAt(0) + 1);
        if (nextRow <= 'D' && home[`${nextRow}_DATA`]) {
            const nextItemName = home[`${nextRow}_DATA`][`${nextRow}${col}I`];
            // เช็คว่า secondary slot เป็น "OCCUPIED" (สำหรับ 2x2 vertical)
            if (nextItemName === "OCCUPIED") {
                is2x2Vertical = true;
            }
        }
    }
    
    // ลบเฟอร์นิเจอร์
    if (is2x2Horizontal) {
        // ลบแนวนอน (D1-D2)
        const nextCol = col + 1;
        home[`${row}_DATA`][`${row}${col}`] = false;
        home[`${row}_DATA`][`${row}${col}I`] = "";
        home[`${row}_DATA`][`${row}${nextCol}`] = false;
        home[`${row}_DATA`][`${row}${nextCol}I`] = "";
    } else if (is2x2Vertical) {
        // ลบแนวตั้ง (A1-B1)
        const nextRow = String.fromCharCode(row.charCodeAt(0) + 1);
        home[`${row}_DATA`][`${row}${col}`] = false;
        home[`${row}_DATA`][`${row}${col}I`] = "";
        home[`${nextRow}_DATA`][`${nextRow}${col}`] = false;
        home[`${nextRow}_DATA`][`${nextRow}${col}I`] = "";
    } else {
        // ลบเฟอร์นิเจอร์ 1x1
        home[`${row}_DATA`][keyFlag] = false;
        home[`${row}_DATA`][keyItem] = "";
    }
    
    return true;
}

module.exports = {
    buildRemoveOptions,
    removeFurnitureSlot,
    findItemDefByName,
    returnItemToInventory
};
