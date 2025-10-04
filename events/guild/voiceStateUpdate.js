const { addUserToVoice, removeUserFromVoice } = require('../../handlers/VoiceMoneyHandler');

module.exports = async (client, oldState, newState) => {
    try {
        const guildId = newState.guild.id;
        const userId = newState.member.id;
        const targetGuildId = '1169274513901486192';
        
        // ตรวจสอบว่าเป็น guild ที่ถูกต้อง
        if (guildId !== targetGuildId) return;
        
        // ผู้ใช้เข้าร่วมห้อง voice
        if (!oldState.channelId && newState.channelId) {
            addUserToVoice(guildId, userId);
        }
        
        // ผู้ใช้ออกจากห้อง voice
        if (oldState.channelId && !newState.channelId) {
            removeUserFromVoice(guildId, userId);
        }
        
        // ผู้ใช้เปลี่ยนห้อง voice
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            // หยุดการติดตามห้องเก่า
            removeUserFromVoice(guildId, userId);
            // เริ่มการติดตามห้องใหม่
            addUserToVoice(guildId, userId);
        }
        
    } catch (error) {
        console.error('Error in voice state update event:', error);
    }
};
