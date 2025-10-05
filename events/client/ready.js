module.exports = async (client) => {
    console.log(`[INFO] ${client.user.tag} (${client.user.id}) is Ready!`);

    let guilds = client.guilds.cache.size;
    let members = client.guilds.cache.reduce((a, b) => a + b.memberCount, 0);
    let channels = client.channels.cache.size;

    const activities = [
        `/สัตว์เลี้ยง บ้าน | ${guilds} เซิร์ฟเวอร์`,
        `/ร้านค้า | ${members} ผู้ใช้งาน`,
        `/เป๋าตัง | ${channels} ห้อง`,
    ]

    setInterval(() => {
        client.user.setPresence({ 
            activities: [{ name: `${activities[Math.floor(Math.random() * activities.length)]}`, type: 2 }], 
            status: 'online', 
        });
    }, 15000)

    // Rebuild voice money tracking on startup
    try {
        const { GUILD_ID } = require('../../settings/config');
        const targetGuildId = GUILD_ID;
        const { addUserToVoice } = require('../../handlers/VoiceMoneyHandler');
        const VoiceSession = require('../../settings/models/voiceSession');
        const guild = client.guilds.cache.get(targetGuildId);
        if (guild) {
            // Iterate current voice states and add users who are in a channel
            // สร้างหรือคง session ใน DB สำหรับผู้ที่ยังอยู่ในห้อง
            const tasks = [];
            guild.voiceStates?.cache?.forEach((vs) => {
                if (vs.channelId) {
                    tasks.push((async () => {
                        try {
                            await VoiceSession.updateOne(
                                { guild: guild.id, user: vs.id },
                                { $setOnInsert: { joinTime: new Date() } },
                                { upsert: true }
                            );
                            await addUserToVoice(guild.id, vs.id);
                        } catch (e) { console.error('VOICE_INIT rebuild error:', e); }
                    })());
                }
            });
            await Promise.all(tasks);
            console.log(`[VOICE_INIT] Rebuilt ${guild.voiceStates?.cache?.size || 0} voice states for guild ${guild.id}`);
        }
    } catch (e) {
        console.error('[VOICE_INIT] Failed to rebuild voice sessions on ready:', e);
    }

};
