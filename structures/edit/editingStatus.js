const { getEditingStatus, forceUnlock } = require('./furnitureUnified.js');

// ฟังก์ชันสำหรับตรวจสอบสถานะการแก้ไขบ้าน
const checkEditingStatus = (userId) => {
    return getEditingStatus(userId);
};

// ฟังก์ชันสำหรับบังคับปลดล็อค (สำหรับแอดมิน)
const unlockUser = (userId) => {
    forceUnlock(userId);
    return true;
};

// ฟังก์ชันสำหรับแสดงสถานะการแก้ไขในรูปแบบข้อความ
const getEditingStatusMessage = (userId) => {
    const status = getEditingStatus(userId);
    
    if (!status.isEditing) {
        return "ไม่มีการแก้ไขบ้านอยู่";
    }
    
    const timeRemaining = Math.ceil(status.timeRemaining / 1000);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    return `กำลังแก้ไขบ้านอยู่ (${status.section} section) - เหลือเวลา ${minutes}:${seconds.toString().padStart(2, '0')}`;
};

module.exports = {
    checkEditingStatus,
    unlockUser,
    getEditingStatusMessage
};

