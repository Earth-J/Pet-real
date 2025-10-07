const { addUserToVoice, removeUserFromVoice } = require('../../handlers/VoiceMoneyHandler');

module.exports = async (client, oldState, newState) => {
    try {
        const guildId = newState.guild.id;
        const userId = newState.member.id;
        const { GUILD_ID } = require('../../settings/config');
        const targetGuildId = GUILD_ID;
        
        // ตรวจสอบว่าเป็น guild ที่ถูกต้อง
        if (guildId !== targetGuildId) return;
        
        // ผู้ใช้เข้าร่วมห้อง voice
        if (!oldState.channelId && newState.channelId) {
            addUserToVoice(client, guildId, userId);
        }
        
        // ผู้ใช้ออกจากห้อง voice
        if (oldState.channelId && !newState.channelId) {
            removeUserFromVoice(client, guildId, userId);
        }
        
        // ผู้ใช้เปลี่ยนห้อง voice
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            // หยุดการติดตามห้องเก่า (ระบุว่าเป็นการย้ายห้อง เพื่อลด log ชวนสับสนและไม่ลบ session)
            removeUserFromVoice(client, guildId, userId, 'switch');
            // เริ่มการติดตามห้องใหม่
            addUserToVoice(client, guildId, userId);
        }
        
    } catch (error) {
        console.error('Error in voice state update event:', error);
    }
};
