const cron = require('node-cron');
const GProfile = require('../settings/models/profile');
const { withUserLock } = require('../structures/services/userLock');

// เก็บข้อมูลผู้ใช้ใน voice channel
const voiceUsers = new Map();

// ฟังก์ชันเริ่มต้นระบบเงินจาก voice
function initVoiceMoneySystem() {
    console.log('🎤 เริ่มต้นระบบเงินจาก Voice Channel...');
    
    // รันทุกนาที
    cron.schedule('* * * * *', async () => {
        try {
            const now = Date.now();
            const targetGuildId = '1169274513901486192';
            
            // วนลูปผู้ใช้ใน voice channel
            for (const [userId, userData] of voiceUsers.entries()) {
                if (userData.guildId !== targetGuildId) continue;
                
                const timeSpent = Math.floor((now - userData.joinTime) / 1000 / 60); // นาที
                
                if (timeSpent >= 1) {
                    // ให้เงิน 100 ต่อนาที
                    const moneyToGive = timeSpent * 100;
                    
                    await withUserLock(userData.guildId, userId, async () => {
                        await GProfile.findOneAndUpdate(
                            { guild: userData.guildId, user: userId },
                            { $inc: { money: moneyToGive } },
                            { upsert: true, new: true }
                        );
                    });
                    
                    // อัปเดตเวลาที่เข้าร่วม
                    userData.joinTime = now;
                    
                    console.log(`💰 ให้เงิน ${userId} จำนวน ${moneyToGive} เหรียญ (${timeSpent} นาที)`);
                }
            }
        } catch (error) {
            console.error('❌ ข้อผิดพลาดในระบบเงินจาก Voice:', error);
        }
    });
    
    console.log('✅ ระบบเงินจาก Voice Channel เริ่มต้นแล้ว');
}

// ฟังก์ชันเพิ่มผู้ใช้ใน voice channel
function addUserToVoice(guildId, userId) {
    voiceUsers.set(userId, {
        guildId,
        joinTime: Date.now()
    });
    console.log(`🎤 ผู้ใช้ ${userId} เข้า voice channel ใน guild ${guildId}`);
}

// ฟังก์ชันลบผู้ใช้ออกจาก voice channel
function removeUserFromVoice(guildId, userId) {
    const userData = voiceUsers.get(userId);
    if (userData && userData.guildId === guildId) {
        const timeSpent = Math.floor((Date.now() - userData.joinTime) / 1000 / 60);
        if (timeSpent >= 1) {
            const moneyToGive = timeSpent * 100;
            console.log(`💰 ให้เงิน ${userId} จำนวน ${moneyToGive} เหรียญ (${timeSpent} นาที) ก่อนออกจาก voice`);
        }
        voiceUsers.delete(userId);
        console.log(`🎤 ผู้ใช้ ${userId} ออกจาก voice channel ใน guild ${guildId}`);
    }
}

module.exports = {
    voiceUsers,
    initVoiceMoneySystem,
    addUserToVoice,
    removeUserFromVoice
};