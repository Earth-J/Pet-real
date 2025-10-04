const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, SelectMenuOptionBuilder } = require("discord.js");
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
const FEED_COOLDOWN = 2 * 60 * 1000; // 2 minutes cooldown

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
    description: "Feed your pet. (2 minute cooldown)",
    category: "Pet",
    run: async (client, interaction) => {
        await interaction.deferReply({ ephemeral: false });

        // ตรวจสอบ cooldown
        const cooldownRemaining = checkCooldown(interaction.user.id);
        if (cooldownRemaining > 0) {
            return interaction.editReply(`⏰ คุณต้องรอ **${cooldownRemaining} วินาที** ก่อนที่จะให้อาหารสัตว์เลี้ยงได้อีกครั้ง`);
        }

        const msg = await interaction.editReply("Loading please wait...");

        const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

        const value = Object.values(inv.item);
        const object = value.filter(x => x.type === "food");
        // if not have food return msg
        if(object.length === 0) {
            return msg.edit({ content: "ไม่มีอาหารในกระเป๋า" });
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
                        return new SelectMenuOptionBuilder()
                            .setLabel(`${toOppositeCase(key.name)}`)
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
                await menu.reply({ content: "เมนูนี้สำหรับผู้ที่เรียกคำสั่งเท่านั้น", ephemeral: true }); 
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
                    await processFeedAction(client, interaction, msg, item.id);
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

// ฟังก์ชันประมวลผลการให้อาหารด้วยระบบพฤติกรรมสัตว์เลี้ยงใหม่
async function processFeedAction(client, interaction, msg, itemId) {
    try {
        const GPet = require("../../settings/models/pet.js");
        const pet = await GPet.findOne({ guild: interaction.guild.id, user: interaction.user.id });
        
        if (!pet) {
            return msg.edit({ content: "คุณยังไม่มีสัตว์เลี้ยง", embeds: [], components: [] });
        }

        // ตรวจสอบว่าสัตว์กำลังนอนอยู่หรือไม่
        if (petSleepSystem.isPetSleeping(pet._id)) {
            const remainingMinutes = petSleepSystem.getRemainingSleepTime(pet._id);
            return msg.edit({ 
                content: `😴 สัตว์เลี้ยงกำลังนอนอยู่ ต้องรออีก **${remainingMinutes} นาที** ก่อนจะตื่น`, 
                embeds: [], 
                components: [] 
            });
        }

        // ใช้ระบบพฤติกรรมสัตว์เลี้ยงใหม่
        const result = await petBehaviorSystem.processPlayerAction(pet._id, 'feed');
        
        if (!result.success) {
            return msg.edit({ content: `เกิดข้อผิดพลาด: ${result.error}`, embeds: [], components: [] });
        }

        // ดึงข้อมูลสัตว์เลี้ยงที่อัปเดตแล้ว
        const updatedPet = await GPet.findById(pet._id);
        const emotion = getEmotionKey(updatedPet);
        const pose = getPoseKey(updatedPet);
        const health = calculateHealth(updatedPet);
        const healthStatus = getHealthStatus(health);
        const careRecommendations = getCareRecommendations(updatedPet);

        // สร้าง embed
        const embed = new EmbedBuilder()
            .setTitle(`🍖 ให้อาหาร ${pet.name}`)
            .setColor('#00ff00')
            .setThumbnail(interaction.user.avatarURL())
            .setTimestamp();

        // แสดงปฏิกิริยาของสัตว์เลี้ยง
        if (result.reactions && result.reactions.length > 0) {
            embed.addFields({
                name: "💬 ปฏิกิริยาของสัตว์เลี้ยง",
                value: result.reactions.join('\n'),
                inline: false
            });
        }

        // แสดงการเปลี่ยนแปลงของค่า
        const oldStats = {
            fatigue: pet.fatigue,
            affection: pet.affection,
            fullness: pet.fullness,
            dirtiness: pet.dirtiness
        };

        const newStats = result.stats;

        let changesText = '';
        if (oldStats.fatigue !== newStats.fatigue) {
            const change = newStats.fatigue - oldStats.fatigue;
            changesText += `**ความล้า:** ${oldStats.fatigue} → ${newStats.fatigue} (${change > 0 ? '+' : ''}${change})\n`;
        }
        if (oldStats.affection !== newStats.affection) {
            const change = newStats.affection - oldStats.affection;
            changesText += `**ความเอ็นดู:** ${oldStats.affection} → ${newStats.affection} (${change > 0 ? '+' : ''}${change})\n`;
        }
        if (oldStats.fullness !== newStats.fullness) {
            const change = newStats.fullness - oldStats.fullness;
            changesText += `**ความอิ่ม:** ${oldStats.fullness} → ${newStats.fullness} (${change > 0 ? '+' : ''}${change})\n`;
        }
        if (oldStats.dirtiness !== newStats.dirtiness) {
            const change = newStats.dirtiness - oldStats.dirtiness;
            changesText += `**ความสกปรก:** ${oldStats.dirtiness} → ${newStats.dirtiness} (${change > 0 ? '+' : ''}${change})\n`;
        }

        if (changesText) {
            embed.addFields({
                name: "📊 การเปลี่ยนแปลงของค่า",
                value: changesText,
                inline: false
            });
        }

        // แสดงสถานะปัจจุบัน
        const emotionEmoji = getEmotionEmoji(emotion);
        embed.addFields(
            {
                name: "💖 ค่าปัจจุบัน",
                value: `**ความเอ็นดู:** ${newStats.affection}/20\n**ความอิ่ม:** ${newStats.fullness}/20\n**ความล้า:** ${newStats.fatigue}/20\n**ความสกปรก:** ${newStats.dirtiness}/20`,
                inline: true
            },
            {
                name: "🎭 สถานะปัจจุบัน",
                value: `${emotionEmoji} **อีโมต:** ${getEmotionDescription(emotion)}\n🎭 **ท่าทาง:** ${getPoseDescription(pose)}\n🏥 **สุขภาพ:** ${health}/20 (${getHealthDescription(healthStatus)})`,
                inline: true
            }
        );

        // แสดงคำแนะนำต่อไป
        if (careRecommendations.length > 0) {
            const urgentRecs = careRecommendations.filter(rec => rec.priority === 'urgent');
            const highRecs = careRecommendations.filter(rec => rec.priority === 'high');

            if (urgentRecs.length > 0 || highRecs.length > 0) {
                let nextStepsText = '';
                
                if (urgentRecs.length > 0) {
                    nextStepsText += '🚨 **ควรทำทันที:**\n';
                    urgentRecs.forEach(rec => {
                        nextStepsText += `${rec.emoji} ${rec.message}\n`;
                    });
                    nextStepsText += '\n';
                }

                if (highRecs.length > 0) {
                    nextStepsText += '⚠️ **ควรทำเร็วๆ นี้:**\n';
                    highRecs.forEach(rec => {
                        nextStepsText += `${rec.emoji} ${rec.message}\n`;
                    });
                }

                if (nextStepsText) {
                    embed.addFields({
                        name: "📋 ขั้นตอนต่อไป",
                        value: nextStepsText,
                        inline: false
                    });
                }
            }
        }

        // Footer
        embed.setFooter({ 
            text: `การให้อาหารเสร็จสิ้น • ${pet.name} รู้สึกดีขึ้น!` 
        });

        await msg.edit({ embeds: [embed], components: [] });

    } catch (error) {
        console.error('Error in processFeedAction:', error);
        await msg.edit({ 
            content: "เกิดข้อผิดพลาดในการให้อาหารสัตว์เลี้ยง กรุณาลองใหม่อีกครั้ง", 
            embeds: [], 
            components: [] 
        });
    }
}