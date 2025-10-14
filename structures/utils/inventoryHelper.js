/**
 * Helper function สำหรับจัดการ inventory ที่สามารถเป็นได้ทั้ง array และ object
 * @param {Object} inv - Inventory object ที่มี property item
 * @returns {Array} - Array ของ items ใน inventory
 */
function invToArray(inv) {
    if (!inv || !inv.item) {
        return [];
    }
    
    // ถ้า inv.item เป็น array อยู่แล้ว ให้ return ตามเดิม
    if (Array.isArray(inv.item)) {
        return inv.item;
    }
    
    // ถ้า inv.item เป็น object ให้แปลงเป็น array
    if (typeof inv.item === 'object') {
        return Object.values(inv.item);
    }
    
    // ถ้าไม่ใช่ทั้ง array และ object ให้ return empty array
    return [];
}

/**
 * Helper function สำหรับค้นหา item ใน inventory
 * @param {Object} inv - Inventory object
 * @param {Function} predicate - ฟังก์ชันสำหรับค้นหา (เช่น x => x.id === id)
 * @returns {Object|null} - Item ที่พบหรือ null
 */
function findInInventory(inv, predicate) {
    const items = invToArray(inv);
    return items.find(predicate) || null;
}

/**
 * Helper function สำหรับกรอง items ใน inventory
 * @param {Object} inv - Inventory object
 * @param {Function} predicate - ฟังก์ชันสำหรับกรอง (เช่น x => x.type === "floor")
 * @returns {Array} - Array ของ items ที่ผ่านการกรอง
 */
function filterInventory(inv, predicate) {
    const items = invToArray(inv);
    return items.filter(predicate);
}

/**
 * Helper function สำหรับเพิ่ม item เข้า inventory
 * @param {Object} inv - Inventory object
 * @param {Object} item - Item ที่ต้องการเพิ่ม
 * @returns {void}
 */
function addToInventory(inv, item) {
    if (!inv.item) {
        inv.item = [];
    }
    
    // ถ้า inv.item เป็น array ให้ push เข้าไป
    if (Array.isArray(inv.item)) {
        inv.item.push(item);
    } else {
        // ถ้า inv.item เป็น object ให้เพิ่ม key ใหม่
        const key = item.id || Date.now().toString();
        inv.item[key] = item;
    }
}

/**
 * Helper function สำหรับลบ item ออกจาก inventory
 * @param {Object} inv - Inventory object
 * @param {Function} predicate - ฟังก์ชันสำหรับค้นหา item ที่ต้องการลบ
 * @returns {boolean} - true ถ้าลบสำเร็จ, false ถ้าไม่พบ item
 */
function removeFromInventory(inv, predicate) {
    const items = invToArray(inv);
    const index = items.findIndex(predicate);
    
    if (index === -1) {
        return false;
    }
    
    // ถ้า inv.item เป็น array ให้ splice
    if (Array.isArray(inv.item)) {
        inv.item.splice(index, 1);
    } else {
        // ถ้า inv.item เป็น object ให้ delete key
        const item = items[index];
        if (item && item.id) {
            delete inv.item[item.id];
        }
    }
    
    return true;
}

module.exports = {
    invToArray,
    findInInventory,
    filterInventory,
    addToInventory,
    removeFromInventory
};


