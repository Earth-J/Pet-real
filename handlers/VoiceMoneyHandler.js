const cron = require('node-cron');
const GProfile = require('../settings/models/profile');
const VoiceSession = require('../settings/models/voiceSession');
const { withUserLock } = require('../structures/services/userLock');

// เก็บข้อมูลผู้ใช้ใน voice channel
const voiceUsers = new Map();

// helper: แปลง userId เป็นชื่อที่อ่านง่าย
function getUserLabel(client, guildId, userId) {
    try {
        const guild = client.guilds.cache.get(guildId);
        const member = guild?.members?.cache?.get(userId);
        return member?.user?.tag || member?.displayName || userId;
    } catch (_) {
        return userId;
    }
}

// ฟังก์ชันเริ่มต้นระบบเงินจาก voice
function initVoiceMoneySystem(client) {
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
                    const label = getUserLabel(client, userData.guildId, userId);
                    console.log(`💰 ให้เงิน ${label} จำนวน ${moneyToGive} เหรียญ (${timeSpent} นาที)`);
                }
            }
        } catch (error) {
            console.error('❌ ข้อผิดพลาดในระบบเงินจาก Voice:', error);
        }
    });
    
    console.log('✅ ระบบเงินจาก Voice Channel เริ่มต้นแล้ว');
}

// ฟังก์ชันเพิ่มผู้ใช้ใน voice channel
async function addUserToVoice(client, guildId, userId) {
    const now = Date.now();
    voiceUsers.set(userId, { guildId, joinTime: now });
    try {
        await VoiceSession.updateOne(
            { guild: guildId, user: userId },
            { $setOnInsert: { joinTime: new Date(now) } },
            { upsert: true }
        );
    } catch (e) { console.error('VOICE_DB addUser error:', e); }
    const label = getUserLabel(client, guildId, userId);
    console.log(`🎤 ผู้ใช้ ${label} เข้า voice channel ใน guild ${guildId}`);
}

// ฟังก์ชันลบผู้ใช้ออกจาก voice channel
// reason: 'leave' | 'switch'  (switch = ย้ายห้อง ไม่ถือว่าออกทั้งหมด)
async function removeUserFromVoice(client, guildId, userId, reason = 'leave') {
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
                const label = getUserLabel(client, guildId, userId);
                if (reason === 'leave') {
                    console.log(`💰 จ่ายก่อนออก ${label} จำนวน ${moneyToGive} เหรียญ (${timeSpent} นาที)`);
                } else {
                    console.log(`💰 คำนวณเงินก่อนย้ายห้อง ${label} จำนวน ${moneyToGive} เหรียญ (${timeSpent} นาที)`);
                }
            }
        }
    } catch (e) { console.error('VOICE_DB removeUser error:', e); }
    finally {
        // ถ้าเป็นการย้ายห้อง ไม่ควรลบ session และไม่ log ว่าออก
        if (reason === 'leave') {
            voiceUsers.delete(userId);
            try { await VoiceSession.deleteOne({ guild: guildId, user: userId }); } catch {}
            const label = getUserLabel(client, guildId, userId);
            console.log(`🎤 ผู้ใช้ ${label} ออกจาก voice channel ใน guild ${guildId}`);
        }
    }
}

module.exports = {
    voiceUsers,
    initVoiceMoneySystem,
    addUserToVoice,
    removeUserFromVoice
};
