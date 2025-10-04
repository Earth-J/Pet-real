const { EmbedBuilder } = require("discord.js");
const GPet = require("../../settings/models/pet.js");
const { petGameLoop } = require("../../handlers/PetGameLoop");
const { getEmotionKey, getEmotionDescription, getEmotionAdvice, getEmotionEmoji, isUrgentEmotion } = require("../../structures/services/petEmotion");
const { getPoseKey, getPoseDescription, getPoseAdvice } = require("../../structures/services/petPose");
const { calculateHealth, getHealthStatus, getHealthDescription, getHealthAdvice, needsUrgentCare, getCareRecommendations } = require("../../structures/services/petHealthSystem");

module.exports = {
    name: ["สถานะสัตว์เลี้ยง"],
    description: "แสดงสถานะสัตว์เลี้ยงแบบละเอียด พร้อมคำแนะนำการดูแล",
    category: "Pet",
    run: async (client, interaction) => {
        try {
            await interaction.deferReply({ ephemeral: false });

            const pet = await GPet.findOne({ guild: interaction.guild.id, user: interaction.user.id });
            if (!pet) {
                return interaction.editReply("คุณยังไม่มีสัตว์เลี้ยง กรุณาใช้คำสั่ง `/pet starter` เพื่อสร้างสัตว์เลี้ยงใหม่");
            }

            // คำนวณสถานะปัจจุบัน
            const emotion = getEmotionKey(pet);
            const pose = getPoseKey(pet);
            const health = calculateHealth(pet);
            const healthStatus = getHealthStatus(health);
            const needsUrgent = needsUrgentCare(pet);
            const careRecommendations = getCareRecommendations(pet);

            // สร้าง embed
            const embed = new EmbedBuilder()
                .setTitle(`🐾 สถานะสัตว์เลี้ยง: ${pet.name}`)
                .setColor(needsUrgent ? '#ff0000' : (health >= 15 ? '#00ff00' : '#ffaa00'))
                .setThumbnail(interaction.user.avatarURL())
                .setTimestamp();

            // ข้อมูลพื้นฐาน
            embed.addFields(
                {
                    name: "📊 ข้อมูลพื้นฐาน",
                    value: `**ชื่อ:** ${pet.name}\n**ประเภท:** ${pet.type}\n**ระดับ:** ${pet.level}\n**ประสบการณ์:** ${pet.exp}/${pet.nextexp}`,
                    inline: true
                },
                {
                    name: "💖 ค่าหลัก",
                    value: `**ความเอ็นดู:** ${pet.affection}/20\n**ความอิ่ม:** ${pet.fullness}/20\n**ความล้า:** ${pet.fatigue}/20\n**ความสกปรก:** ${pet.dirtiness}/20`,
                    inline: true
                },
                {
                    name: "🏥 สุขภาพ",
                    value: `**สุขภาพรวม:** ${health}/20\n**สถานะ:** ${getHealthDescription(healthStatus)}\n**ต้องการการดูแลเร่งด่วน:** ${needsUrgent ? 'ใช่' : 'ไม่'}`,
                    inline: true
                }
            );

            // สถานะปัจจุบัน
            const emotionEmoji = getEmotionEmoji(emotion);
            const urgentIcon = needsUrgent ? '🚨' : '';
            
            embed.addFields(
                {
                    name: `${emotionEmoji} อีโมตปัจจุบัน`,
                    value: `**${getEmotionDescription(emotion)}**\n${getEmotionAdvice(emotion)}`,
                    inline: true
                },
                {
                    name: "🎭 ท่าทางปัจจุบัน",
                    value: `**${getPoseDescription(pose)}**\n${getPoseAdvice(pose)}`,
                    inline: true
                },
                {
                    name: "💡 คำแนะนำสุขภาพ",
                    value: getHealthAdvice(healthStatus),
                    inline: true
                }
            );

            // คำแนะนำการดูแล
            if (careRecommendations.length > 0) {
                const urgentRecs = careRecommendations.filter(rec => rec.priority === 'urgent');
                const highRecs = careRecommendations.filter(rec => rec.priority === 'high');
                const mediumRecs = careRecommendations.filter(rec => rec.priority === 'medium');

                let recommendationsText = '';
                
                if (urgentRecs.length > 0) {
                    recommendationsText += '🚨 **เร่งด่วน:**\n';
                    urgentRecs.forEach(rec => {
                        recommendationsText += `${rec.emoji} ${rec.message}\n`;
                    });
                    recommendationsText += '\n';
                }

                if (highRecs.length > 0) {
                    recommendationsText += '⚠️ **สำคัญ:**\n';
                    highRecs.forEach(rec => {
                        recommendationsText += `${rec.emoji} ${rec.message}\n`;
                    });
                    recommendationsText += '\n';
                }

                if (mediumRecs.length > 0) {
                    recommendationsText += 'ℹ️ **แนะนำ:**\n';
                    mediumRecs.forEach(rec => {
                        recommendationsText += `${rec.emoji} ${rec.message}\n`;
                    });
                }

                if (recommendationsText) {
                    embed.addFields({
                        name: "📋 คำแนะนำการดูแล",
                        value: recommendationsText,
                        inline: false
                    });
                }
            }

            // ปฏิกิริยาล่าสุด
            if (pet.lastReactions && pet.lastReactions.length > 0) {
                embed.addFields({
                    name: "💬 ปฏิกิริยาล่าสุด",
                    value: pet.lastReactions.join('\n'),
                    inline: false
                });
            }

            // ข้อมูลระบบ
            const systemStats = petGameLoop.getStats();
            embed.addFields({
                name: "⚙️ ข้อมูลระบบ",
                value: `**อัปเดตล่าสุด:** <t:${Math.floor(pet.lastUpdate?.getTime() / 1000) || 0}:R>\n**Tick ล่าสุด:** #${pet.lastTick || 0}\n**ระบบทำงาน:** ${systemStats.isRunning ? '✅' : '❌'}`,
                inline: false
            });

            // Footer
            embed.setFooter({ 
                text: needsUrgent ? '🚨 สัตว์เลี้ยงต้องการการดูแลเร่งด่วน!' : '💖 ดูแลสัตว์เลี้ยงของคุณให้ดีนะ' 
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in petstatus command:', error);
            try {
                await interaction.editReply({ 
                    content: "เกิดข้อผิดพลาดในการแสดงสถานะสัตว์เลี้ยง กรุณาลองใหม่อีกครั้ง" 
                });
            } catch (editError) {
                console.error('Failed to edit interaction:', editError);
            }
        }
    }
};

