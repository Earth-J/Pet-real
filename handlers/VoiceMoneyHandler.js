const cron = require('node-cron');
const GProfile = require('../settings/models/profile');
const VoiceSession = require('../settings/models/voiceSession');
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
            const { GUILD_ID } = require('../settings/config');
            const targetGuildId = GUILD_ID;
            
            // วนลูปผู้ใช้ใน voice channel (จากหน่วยความจำ)
            for (const [userId, userData] of voiceUsers.entries()) {
                if (userData.guildId !== targetGuildId) continue;

                // คำนวณเวลาจาก DB เพื่อความทนทาน
                const session = await VoiceSession.findOne({ guild: userData.guildId, user: userId });
                const joinTime = session?.joinTime ? new Date(session.joinTime).getTime() : userData.joinTime;
                const timeSpent = Math.floor((now - joinTime) / 1000 / 60);

                if (timeSpent >= 1) {
                    const moneyToGive = timeSpent * 20;

                    await withUserLock(userData.guildId, userId, async () => {
                        await GProfile.findOneAndUpdate(
                            { guild: userData.guildId, user: userId },
                            { $inc: { money: moneyToGive } },
                            { upsert: true, new: true }
                        );
                        // รีเซ็ต joinTime ใน DB หลังจ่าย
                        await VoiceSession.updateOne(
                            { guild: userData.guildId, user: userId },
                            { $set: { joinTime: new Date(now) } },
                            { upsert: true }
                        );
                    });

                    // อัปเดตหน่วยความจำ
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
async function addUserToVoice(guildId, userId) {
    const now = Date.now();
    voiceUsers.set(userId, { guildId, joinTime: now });
    try {
        await VoiceSession.updateOne(
            { guild: guildId, user: userId },
            { $setOnInsert: { joinTime: new Date(now) } },
            { upsert: true }
        );
    } catch (e) { console.error('VOICE_DB addUser error:', e); }
    console.log(`🎤 ผู้ใช้ ${userId} เข้า voice channel ใน guild ${guildId}`);
}

// ฟังก์ชันลบผู้ใช้ออกจาก voice channel
async function removeUserFromVoice(guildId, userId) {
    const userData = voiceUsers.get(userId);
    try {
        // อ่าน joinTime จาก DB เพื่อคำนวณย้อนหลังแม้ process จะเคยดับ
        const session = await VoiceSession.findOne({ guild: guildId, user: userId });
        const joinMs = session?.joinTime ? new Date(session.joinTime).getTime() : userData?.joinTime;
        if (joinMs) {
            const timeSpent = Math.floor((Date.now() - joinMs) / 1000 / 60);
            if (timeSpent >= 1) {
                const moneyToGive = timeSpent * 25;
                await withUserLock(guildId, userId, async () => {
                    await GProfile.findOneAndUpdate(
                        { guild: guildId, user: userId },
                        { $inc: { money: moneyToGive } },
                        { upsert: true, new: true }
                    );
                });
                console.log(`💰 จ่ายก่อนออก ${userId} จำนวน ${moneyToGive} เหรียญ (${timeSpent} นาที)`);
            }
        }
    } catch (e) { console.error('VOICE_DB removeUser error:', e); }
    finally {
        voiceUsers.delete(userId);
        try { await VoiceSession.deleteOne({ guild: guildId, user: userId }); } catch {}
        console.log(`🎤 ผู้ใช้ ${userId} ออกจาก voice channel ใน guild ${guildId}`);
    }
}

module.exports = {
    voiceUsers,
    initVoiceMoneySystem,
    addUserToVoice,
    removeUserFromVoice
};
