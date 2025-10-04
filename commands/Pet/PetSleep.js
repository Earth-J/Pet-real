const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const GPet = require("../../settings/models/pet.js");
const { getEmotionKey, getEmotionDescription, getEmotionEmoji } = require("../../structures/services/petEmotion");
const { getPoseKey, getPoseDescription } = require("../../structures/services/petPose");
const { getRenderQueue } = require("../../structures/services/renderQueueSingleton");
const { fetchBuffer } = require("../../structures/services/discordUpload");
const { withUserLock } = require("../../structures/services/userLock");
const { updateFireStreak } = require("../../handlers/FireStreakHandler");
const { petBehaviorSystem } = require("../../handlers/PetBehaviorSystem");
const { calculateHealth, getHealthStatus, getHealthDescription, getCareRecommendations } = require("../../structures/services/petHealthSystem");
const { petSleepSystem } = require("../../handlers/PetSleepSystem");

// Cooldown system
const trainCooldowns = new Map();
const TRAIN_COOLDOWN = 10 * 60 * 1000; // 10 minutes cooldown

const PET_ASSET_BASE_URL = (process.env.PET_ASSET_BASE_URL || 'https://cdn.kitsxkorn.xyz').replace(/\/$/, '');
const PET_ASSET_PATH_PREFIX = (process.env.PET_ASSET_PATH_PREFIX || '').replace(/^\/+|\/+$/g, '');
function buildCdnUrl(...segs) { const parts = [PET_ASSET_BASE_URL]; if (PET_ASSET_PATH_PREFIX) parts.push(PET_ASSET_PATH_PREFIX); for (const s of segs) { const v = String(s || '').trim().replace(/^\/+|\/+$/g, ''); if (v) parts.push(v);} return parts.join('/'); }
function cdnPetStaticUrl(state, type) { return buildCdnUrl('pet', state, `${type}.png`); }
async function makePetThumbAttachment(petDoc, state, poseKey) {
  try {
    const queue = getRenderQueue();
    const size = { width: 96, height: 96 };
    const dbGif = String(petDoc?.spriteGifUrl || '').trim();
    if (dbGif) {
      try {
        const buf = await fetchBuffer(dbGif);
        if (Buffer.isBuffer(buf)) return new AttachmentBuilder(buf, { name: 'pet_thumb.gif' });
      } catch (_) {}
    }
    const url = cdnPetStaticUrl(state, poseKey);
    const buf = await fetchBuffer(url);
    if (Buffer.isBuffer(buf)) return new AttachmentBuilder(buf, { name: 'pet_thumb.png' });
  } catch (_) {}
  return null;
}

module.exports = {
  name: ["สัตว์เลี้ยง", "เข้านอน"],
  description: "ให้นอนสัตว์เลี้ยง (ต้องรอ 15-20 นาที)",
  category: "Pet",

  async run(interaction) {
    await withUserLock(interaction.user.id, async () => {
      try {
        await interaction.deferReply();

        const pet = await GPet.findOne({ 
          guild: interaction.guild.id, 
          user: interaction.user.id 
        });

        if (!pet) {
          return interaction.editReply({ 
            content: "คุณยังไม่มีสัตว์เลี้ยง" 
          });
        }

        // ตรวจสอบ cooldown
        const cooldownTime = trainCooldowns.get(interaction.user.id);
        if (cooldownTime && Date.now() - cooldownTime < TRAIN_COOLDOWN) {
          const remainingTime = Math.ceil((TRAIN_COOLDOWN - (Date.now() - cooldownTime)) / 1000);
          return interaction.editReply({ 
            content: `⏰ คุณต้องรออีก **${remainingTime} วินาที** ก่อนจะให้นอนสัตว์เลี้ยงได้อีกครั้ง` 
          });
        }

        // เก็บสถานะก่อนนอน
        const before = {
          affection: Number(pet.affection ?? 0),
          fullness: Number(pet.fullness ?? pet.hungry ?? 0),
          fatigue: Number(pet.fatigue ?? 0),
          dirtiness: Number(pet.dirtiness ?? (20 - Number(pet.cleanliness ?? 20)))
        };

        // Guards removed - allow all actions regardless of pet condition

        // ตรวจสอบว่าสัตว์กำลังนอนอยู่หรือไม่
        if (petSleepSystem.isPetSleeping(pet._id)) {
          const remainingMinutes = petSleepSystem.getRemainingSleepTime(pet._id);
          return interaction.editReply({ 
            content: `😴 สัตว์เลี้ยงกำลังนอนอยู่ ต้องรออีก **${remainingMinutes} นาที** ก่อนจะตื่น` 
          });
        }

        // แสดงหน้าจอยืนยันการนอน
        await this.showSleepConfirmation(interaction, pet, before);

      } catch (error) {
        console.error('Error in PetSleep:', error);
        await interaction.editReply({ 
          content: "เกิดข้อผิดพลาดในการให้นอนสัตว์เลี้ยง กรุณาลองใหม่อีกครั้ง" 
        });
      }
    });
  },

  /**
   * แสดงหน้าจอยืนยันการนอน
   */
  async showSleepConfirmation(interaction, pet, beforeStats) {
    try {
      // สร้าง embed สำหรับยืนยัน
      const confirmEmbed = new EmbedBuilder()
        .setTitle(`💤 ยืนยันการให้นอน ${pet.name}`)
        .setDescription(`คุณแน่ใจหรือไม่ที่จะให้นอน ${pet.name}?`)
        .setColor('#ffa500')
        .setThumbnail(interaction.user.avatarURL())
        .setTimestamp();

      // แสดงข้อมูลการนอน
      confirmEmbed.addFields({
        name: "😴 ข้อมูลการนอน",
        value: `**เวลานอน:** 15-20 นาที (สุ่ม)\n**สถานะ:** จะไม่สามารถทำกิจกรรมอื่นได้\n**แจ้งเตือน:** จะได้รับ DM เมื่อตื่น`,
        inline: false
      });

      // แสดงสถานะปัจจุบัน
      confirmEmbed.addFields({
        name: "💖 สถานะปัจจุบัน",
        value: `**ความเอ็นดู:** ${beforeStats.affection}/20\n**ความอิ่ม:** ${beforeStats.fullness}/20\n**ความล้า:** ${beforeStats.fatigue}/20\n**ความสกปรก:** ${beforeStats.dirtiness}/20`,
        inline: true
      });

      confirmEmbed.addFields({
        name: "⚠️ ข้อควรทราบ",
        value: `• สัตว์เลี้ยงจะไม่สามารถทำกิจกรรมอื่นได้จนกว่าจะตื่น\n• ระหว่างนอน fatigue จะไม่เพิ่มขึ้น\n• จะได้รับแจ้งเตือนใน DM เมื่อตื่นแล้ว`,
        inline: true
      });

      // สร้างปุ่มยืนยัน
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`sleep_confirm_${pet._id}`)
            .setLabel('💤 ให้นอน')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`sleep_cancel_${pet._id}`)
            .setLabel('❌ ยกเลิก')
            .setStyle(ButtonStyle.Danger)
        );

      confirmEmbed.setFooter({ 
        text: `กดปุ่มเพื่อยืนยันหรือยกเลิกการให้นอน` 
      });

      await interaction.editReply({ 
        embeds: [confirmEmbed], 
        components: [row] 
      });

    } catch (error) {
      console.error('Error in showSleepConfirmation:', error);
      await interaction.editReply({ 
        content: "เกิดข้อผิดพลาดในการแสดงหน้าจอยืนยัน กรุณาลองใหม่อีกครั้ง" 
      });
    }
  },

  /**
   * ประมวลผลการยืนยันการนอน
   */
  async processSleepConfirmation(interaction, petId, action) {
    try {
      if (action === 'cancel') {
        const cancelEmbed = new EmbedBuilder()
          .setTitle('❌ ยกเลิกการให้นอน')
          .setDescription('การให้นอนถูกยกเลิกแล้ว')
          .setColor('#ff0000')
          .setTimestamp();

        await interaction.update({ 
          embeds: [cancelEmbed], 
          components: [] 
        });
        return;
      }

      if (action === 'confirm') {
        // เริ่มการนอน
        const sleepResult = await petSleepSystem.startSleep(petId);
        
        if (!sleepResult.success) {
          await interaction.update({ 
            content: sleepResult.message,
            embeds: [],
            components: []
          });
          return;
        }

        // อัปเดต cooldown
        trainCooldowns.set(interaction.user.id, Date.now());

        // อัปเดต fire streak
        await updateFireStreak(interaction.guild.id, interaction.user.id);

        // ดึงข้อมูลสัตว์เลี้ยงที่อัปเดตแล้ว
        const updated = await GPet.findById(petId);

        // level up check
        let leveledUp = false;
        let exp = Number(updated.exp || 0);
        let level = Number(updated.level || 1);
        let nextexp = Number(updated.nextexp || Math.floor(level * level * 1.5));
        if (exp >= nextexp) {
          const diff = exp - nextexp;
          level += 1;
          nextexp = Math.floor(level * level * 1.5);
          await GPet.updateOne(
            { guild: interaction.guild.id, user: interaction.user.id },
            { $set: { level, nextexp, exp: diff } }
          );
          leveledUp = true;
        }

        const state = getEmotionKey(updated);
        const poseKey = getPoseKey(updated);
        const thumbAtt = await makePetThumbAttachment(updated, state, poseKey);

        // คำนวณสถานะปัจจุบัน
        const emotion = getEmotionKey(updated);
        const pose = getPoseKey(updated);
        const health = calculateHealth(updated);
        const healthStatus = getHealthStatus(health);
        const careRecommendations = getCareRecommendations(updated);

        // สร้าง embed
        const embed = new EmbedBuilder()
          .setTitle(`💤 ให้นอน ${updated.name}`)
          .setColor('#4a90e2')
          .setThumbnail(interaction.user.avatarURL())
          .setTimestamp();

        // แสดงข้อมูลการนอน
        embed.addFields({
          name: "😴 ข้อมูลการนอน",
          value: `**เวลานอน:** ${sleepResult.duration} นาที\n**เวลาตื่น:** <t:${Math.floor(sleepResult.wakeUpTime.getTime() / 1000)}:R>\n**สถานะ:** กำลังนอนหลับ`,
          inline: false
        });

        embed.addFields({
          name: "⚠️ ข้อควรทราบ",
          value: `• สัตว์เลี้ยงจะไม่สามารถทำกิจกรรมอื่นได้จนกว่าจะตื่น\n• ระหว่างนอน fatigue จะไม่เพิ่มขึ้น\n• จะได้รับแจ้งเตือนใน DM เมื่อตื่นแล้ว`,
          inline: false
        });

        // แสดงสถานะปัจจุบันก่อนนอน
        embed.addFields({
          name: "💖 สถานะก่อนนอน",
          value: `**ความเอ็นดู:** ${updated.affection}/20\n**ความอิ่ม:** ${updated.fullness}/20\n**ความล้า:** ${updated.fatigue}/20\n**ความสกปรก:** ${updated.dirtiness}/20`,
          inline: true
        });

        embed.addFields({
          name: "🎭 อารมณ์ก่อนนอน",
          value: `**อีโมต:** ${getEmotionDescription(emotion)}\n**ท่าทาง:** ${getPoseDescription(pose)}\n**สุขภาพ:** ${health}/20 (${getHealthDescription(healthStatus)})`,
          inline: true
        });

        // แสดงข้อมูล EXP และ Level
        embed.addFields({
          name: "📈 ประสบการณ์",
          value: `**EXP:** ${exp}/${nextexp} (+2)\n${leveledUp ? `**เลเวลอัป!** → เลเวล ${level}` : ''}`,
          inline: false
        });

        // Footer
        embed.setFooter({ 
          text: `สัตว์เลี้ยงเริ่มนอนแล้ว • จะตื่นในอีก ${sleepResult.duration} นาที` 
        });

        const files = [];
        if (thumbAtt) { 
          files.push(thumbAtt); 
          embed.setThumbnail('attachment://pet_thumb.gif'); 
        }

        await interaction.update({ 
          embeds: [embed], 
          files,
          components: []
        });
      }

    } catch (error) {
      console.error('Error in processSleepConfirmation:', error);
      await interaction.update({ 
        content: "เกิดข้อผิดพลาดในการประมวลผลการยืนยัน กรุณาลองใหม่อีกครั้ง",
        embeds: [],
        components: []
      });
    }
  }
};