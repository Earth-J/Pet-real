const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const GInv = require("../../settings/models/inventory.js");
const { petSelect } = require("../../structures/select/pet.js");
const { updateFireStreak } = require("../../handlers/FireStreakHandler");
const { petBehaviorSystem } = require("../../handlers/PetBehaviorSystem");
const { getEmotionKey, getEmotionDescription, getEmotionEmoji } = require("../../structures/services/petEmotion");
const { getPoseKey, getPoseDescription } = require("../../structures/services/petPose");
const { calculateHealth, getHealthStatus, getHealthDescription, getCareRecommendations } = require("../../structures/services/petHealthSystem");
const { petSleepSystem } = require("../../handlers/PetSleepSystem");

// Cooldown system
const feedCooldowns = new Map();
const FEED_COOLDOWN = 3 * 60 * 1000; // 3 minutes cooldown (ปรับจาก 2 นาที)

// ตรวจสอบ cooldown
function checkCooldown(userId) {
    const now = Date.now();
    const lastUsed = feedCooldowns.get(userId);
    
    if (lastUsed && (now - lastUsed) < FEED_COOLDOWN) {
        const remaining = Math.ceil((FEED_COOLDOWN - (now - lastUsed)) / 1000);
        return remaining;
    }
    
    return 0;
}

module.exports = {
    name: ["สัตว์เลี้ยง", "ให้อาหาร"],
    description: "ให้อาหารสัตว์เลี้ยง (คูลดาวน์ 3 นาที)",
    category: "Pet",
    run: async (client, interaction) => {
        await interaction.deferReply({ ephemeral: false });

        // ตรวจสอบ cooldown
        const cooldownRemaining = checkCooldown(interaction.user.id);
        if (cooldownRemaining > 0) {
            return interaction.editReply(`⏰ คุณต้องรอ **${cooldownRemaining} วินาที** ก่อนที่จะให้อาหารสัตว์เลี้ยงได้อีกครั้ง`);
        }

        const loadingEmbed = new EmbedBuilder()
            .setTitle('กำลังโหลด')
            .setDescription('โปรดรอสักครู่...')
            .setColor('#cccccc');
        const msg = await interaction.editReply({ embeds: [loadingEmbed] });

        const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

        const value = Object.values(inv.item);
        const object = value.filter(x => x.type === "food");
        // if not have food return msg
        if(object.length === 0) {
            const embedNoFood = new EmbedBuilder()
                .setTitle('ไม่มีอาหารในกระเป๋า')
                .setDescription('คุณยังไม่มีอาหารสำหรับสัตว์เลี้ยง ลองซื้อจากร้านค้าก่อน')
                .setColor('#ff6961');
            return msg.edit({ embeds: [embedNoFood] });
        }

        const embed = new EmbedBuilder()
            .setColor(client.color)
            .setDescription("*กรุณาเลือกอาหาร*")
    
        const select = new ActionRowBuilder()
            .addComponents([
                new StringSelectMenuBuilder()
                    .setCustomId("petselect")
                    .setPlaceholder("เลือกอาหารเพื่อให้อาหารสัตว์เลี้ยง")
                    .setMaxValues(1)
                    .setMinValues(1)
                    .setOptions(object.map(key => {
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(`${toOppositeCase(key.name)}`)
                            .setEmoji(getFoodEmoji(key))
                            .setValue(key.id)
                        }
                    ))
                ])
    
        await msg.edit({ content: " ", embeds: [embed], components: [select] });
    
        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });
        const nonOwnerCollector = msg.createMessageComponentCollector({ filter: (x) => x.user.id !== interaction.user.id, time: 300000 });
        nonOwnerCollector.on('collect', async (menu) => { 
            try { 
                const embedOnlyOwner = new EmbedBuilder()
                    .setTitle('เมนูนี้สำหรับผู้ที่เรียกคำสั่งเท่านั้น')
                    .setColor('#ff6961');
                await menu.reply({ embeds: [embedOnlyOwner], ephemeral: true }); 
            } catch {} 
        });
    
        collector.on('collect', async (menu) => {
            if(menu.isStringSelectMenu()) {
                // id select menus
                if(menu.customId === "petselect") {
                    await menu.deferUpdate();
                    let [ directory ] = menu.values;
    
                    const item = inv.item.find(x => x.id === directory);
    
                    // อัปเดต cooldown
                    feedCooldowns.set(interaction.user.id, Date.now());
    
                    // ใช้ระบบพฤติกรรมสัตว์เลี้ยงใหม่
                    await processFeedAction(client, interaction, msg, item.id, inv);
                    await collector.stop();
                }
            }
        });
    
        collector.on('end', async (collected, reason) => {
            if(reason === 'time') {
                const timed = new EmbedBuilder()
                    .setDescription(`หมดเวลาแล้ว`)
                    .setColor(client.color)
    
                msg.edit({ embeds: [timed], components: [] });
            }
            try { nonOwnerCollector.stop(); } catch {}
        });
    }
}

function toOppositeCase(char) {
    return char.charAt(0).toUpperCase() + char.slice(1);
}

function getFoodEmoji(item) {
    if (item && (item.emoji || item.icon)) return item.emoji || item.icon;
    const name = String(item?.name || '').toLowerCase();
    if (name.includes('fish')) return '🐟';
    if (name.includes('meat') || name.includes('steak')) return '🍖';
    if (name.includes('apple')) return '🍎';
    if (name.includes('banana')) return '🍌';
    if (name.includes('milk')) return '🥛';
    if (name.includes('cookie')) return '🍪';
    if (name.includes('cake')) return '🍰';
    if (name.includes('carrot')) return '🥕';
    if (name.includes('rice')) return '🍚';
    if (name.includes('bread')) return '🍞';
    return '🍖';
}

// ฟังก์ชันประมวลผลการให้อาหารด้วยระบบพฤติกรรมสัตว์เลี้ยงใหม่
async function processFeedAction(client, interaction, msg, itemId, inv) {
    try {
        const GPet = require("../../settings/models/pet.js");
        const pet = await GPet.findOne({ guild: interaction.guild.id, user: interaction.user.id });
        
        if (!pet) {
            const embedNoPet = new EmbedBuilder()
                .setTitle('ไม่พบสัตว์เลี้ยง')
                .setDescription('คุณยังไม่มีสัตว์เลี้ยง กรุณาสร้างสัตว์เลี้ยงก่อนใช้งานคำสั่งนี้')
                .setColor('#ff6961');
            return msg.edit({ embeds: [embedNoPet], components: [] });
        }

        // ตรวจสอบว่าสัตว์กำลังนอนอยู่หรือไม่
        if (petSleepSystem.isPetSleeping(pet._id)) {
            const remainingMinutes = petSleepSystem.getRemainingSleepTime(pet._id);
            const embedSleep = new EmbedBuilder()
                .setTitle('กำลังนอนอยู่')
                .setDescription(`😴 สัตว์เลี้ยงกำลังนอนอยู่ ต้องรออีก **${remainingMinutes} นาที** ก่อนจะตื่น`)
                .setColor('#ff6961');
            return msg.edit({ embeds: [embedSleep], components: [] });
        }

        // ตรวจสอบความเหนื่อยล้า
        const fatigue = Number(pet.fatigue ?? 0);
        if (fatigue >= 20) {
            const embedFat = new EmbedBuilder()
                .setTitle('เหนื่อยล้าเกินไป')
                .setDescription(`😴 **${pet.name} เหนื่อยล้ามากเกินไป!**\nสัตว์เลี้ยงต้องนอนพักผ่อนก่อน ใช้คำสั่ง \`/สัตว์เลี้ยง เข้านอน\``)
                .setColor('#ff6961');
            return msg.edit({ embeds: [embedFat], components: [] });
        }

        // เตือนถ้าเหนื่อยมาก (แต่ยังทำได้)
        let fatigueWarning = '';
        if (fatigue >= 15 && fatigue < 20) {
            fatigueWarning = '\n⚠️ **คำเตือน:** สัตว์เลี้ยงเริ่มเหนื่อยล้ามาก ควรให้นอนพักผ่อนเร็วๆ นี้!';
        }

        // ดึงข้อมูลอาหารที่เลือก
        const selectedFood = inv.item.find(x => x.id === itemId);
        const expBonus = selectedFood?.exp || 1; // EXP จากอาหาร (default 1 ถ้าไม่มี)
        const feedAmount = selectedFood?.feed || 0; // ค่าความอิ่มตามที่ร้านค้ากำหนด

        // ใช้ระบบพฤติกรรมสัตว์เลี้ยงใหม่ พร้อมส่ง EXP bonus และ feedAmount ให้ตรงกับร้านค้า
        const result = await petBehaviorSystem.processPlayerAction(pet._id, 'feed', { expBonus, feedAmount });
        
        if (!result.success) {
            const embedErr = new EmbedBuilder()
                .setTitle('เกิดข้อผิดพลาด')
                .setDescription(`รายละเอียด: ${result.error || 'ไม่ทราบสาเหตุ'}`)
                .setColor('#ff6961');
            return msg.edit({ embeds: [embedErr], components: [] });
        }

        // สร้าง embed
        const embed = new EmbedBuilder()
        .setAuthor({ name: `ให้อาหาร ${pet.name}`, iconURL: "https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/icon-sleep.png" })
            .setColor('#e8f093')
            .setThumbnail('https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/thumbnail/food.png')
            .setTimestamp();

        // แสดงปฏิกิริยาของสัตว์เลี้ยง
        if (result.reactions && result.reactions.length > 0) {
            embed.addFields({
                name: "💬 ปฏิกิริยาของสัตว์เลี้ยง",
                value: result.reactions.join('\n') + fatigueWarning,
                inline: false
            });
        }

        // แสดงการเปลี่ยนแปลงของค่า (สไตล์เดียวกับ Walk/Sleep/Play)
        const oldStats = {
            fatigue: pet.fatigue,
            affection: pet.affection,
            fullness: pet.fullness,
            dirtiness: pet.dirtiness
        };

        const newStats = result.stats;
        const fmt = (n) => (Number.isInteger(n) ? `${n}` : `${Number(n).toFixed(1)}`);
        const sign = (d) => (d > 0 ? `+${fmt(d)}` : `${fmt(d)}`);
        const lines = [];
        // ความสกปรก
        if (oldStats.dirtiness !== newStats.dirtiness) {
            const d = newStats.dirtiness - oldStats.dirtiness;
            lines.push(`<:dirtiness:1424394365677342741> **ความสกปรก:** ${fmt(newStats.dirtiness)}/20 (${sign(d)})`);
        }
        // ความล้า
        if (oldStats.fatigue !== newStats.fatigue) {
            const d = newStats.fatigue - oldStats.fatigue;
            lines.push(`<:fatigue:1424394380604870727> **ความล้า:** ${fmt(newStats.fatigue)}/20 (${sign(d)})`);
        }
        // ความเอ็นดู
        if (oldStats.affection !== newStats.affection) {
            const d = newStats.affection - oldStats.affection;
            lines.push(`<:love:1424394386497601687> **ความเอ็นดู:** ${fmt(newStats.affection)}/20 (${sign(d)})`);
        }
        // ความอิ่ม
        if (oldStats.fullness !== newStats.fullness) {
            const d = newStats.fullness - oldStats.fullness;
            lines.push(`<:Fullness:1424394383855452200> **ความอิ่ม:** ${fmt(newStats.fullness)}/20 (${sign(d)})`);
        }
        // EXP รวมในบล็อคเดียวกัน
        lines.push(`<:exp:1424394377555607592> **EXP :** ${result.exp}/${result.nextexp} (+${fmt(result.expGain)})${result.leveledUp ? `\n**เลเวลอัป!** → เลเวล ${result.level} 🎉` : ''}`);

        embed.addFields({
            name: "ค่าสถานะ",
            value: lines.join('\n'),
            inline: false
        });

        // Footer
        embed.setFooter({ 
            text: `การให้อาหารเสร็จสิ้น • ${pet.name} รู้สึกดีขึ้น!` 
        });

        await msg.edit({ embeds: [embed], components: [] });
        if (result.leveledUp) {
            try {
                const lvlEmbed = new EmbedBuilder()
                    .setColor('#c9ce93')
                    .setTitle('🎉 Level Up!')
                    .setDescription(`${interaction.user} สัตว์เลี้ยงเลเวลอัปเป็นเลเวล **${result.level}**!`);
                await interaction.followUp({ embeds: [lvlEmbed], ephemeral: false });
            } catch {}
        }

    } catch (error) {
        console.error('Error in processFeedAction:', error);
        const embedCatch = new EmbedBuilder()
            .setTitle('เกิดข้อผิดพลาด')
            .setDescription('เกิดข้อผิดพลาดในการให้อาหารสัตว์เลี้ยง กรุณาลองใหม่อีกครั้ง')
            .setColor('#ff6961');
        await msg.edit({ embeds: [embedCatch], components: [] });
    }
}
