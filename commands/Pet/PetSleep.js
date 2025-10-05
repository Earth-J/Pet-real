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
const TRAIN_COOLDOWN = 2 * 60 * 1000; // 2 minutes cooldown

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
  description: "พาสัตว์เลี้ยงเข้านอน (ต้องรอ 5-10 นาที)",
  category: "Pet",

  async run(client, interaction) {
    await withUserLock(interaction.guild.id, interaction.user.id, async () => {
      try {
        await interaction.deferReply();

        const pet = await GPet.findOne({ 
          guild: interaction.guild.id, 
          user: interaction.user.id 
        });

        if (!pet) {
          const embed = new EmbedBuilder()
            .setTitle('ไม่พบสัตว์เลี้ยง')
            .setDescription('คุณยังไม่มีสัตว์เลี้ยง กรุณาสร้างสัตว์เลี้ยงก่อนใช้งานคำสั่งนี้')
            .setColor('#ff6961');
          return interaction.editReply({ embeds: [embed] });
        }

        // ตรวจสอบ cooldown
        const cooldownTime = trainCooldowns.get(interaction.user.id);
        if (cooldownTime && Date.now() - cooldownTime < TRAIN_COOLDOWN) {
          const remainingTime = Math.ceil((TRAIN_COOLDOWN - (Date.now() - cooldownTime)) / 1000);
          const embed = new EmbedBuilder()
            .setTitle('อยู่ในช่วงคูลดาวน์')
            .setDescription(`⏰ คุณต้องรออีก **${remainingTime} วินาที** ก่อนจะให้นอนสัตว์เลี้ยงได้อีกครั้ง`)
            .setColor('#ff6961');
          return interaction.editReply({ embeds: [embed] });
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
          const embed = new EmbedBuilder()
            .setTitle('กำลังนอนอยู่')
            .setDescription(`😴 สัตว์เลี้ยงกำลังนอนอยู่ ต้องรออีก **${remainingMinutes} นาที** ก่อนจะตื่น`)
            .setColor('#ff6961');
          return interaction.editReply({ embeds: [embed] });
        }

        // แสดงหน้าจอยืนยันการนอน
        await this.showSleepConfirmation(interaction, pet, before);

      } catch (error) {
        console.error('Error in PetSleep:', error);
        const embed = new EmbedBuilder()
          .setTitle('เกิดข้อผิดพลาด')
          .setDescription('เกิดข้อผิดพลาดในการให้นอนสัตว์เลี้ยง กรุณาลองใหม่อีกครั้ง')
          .setColor('#ff6961');
        await interaction.editReply({ embeds: [embed] });
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
         .setAuthor({ name: `เเน่ใจที่จะให้ ${pet.name} นอนมั้ย?`, iconURL: "https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/icon-sleep.png" })
        .setColor('#c9ce93')
        .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/bed.png")

      // แสดงข้อมูลการนอน
      confirmEmbed.addFields({
        name: "ข้อมูลการนอน",
        value: `**เวลานอน:** 5-10 นาที (สุ่ม)\n**สถานะ:** จะไม่สามารถทำกิจกรรมอื่นได้\n**แจ้งเตือน:** จะได้รับ DM เมื่อตื่น`,
        inline: false
      });

      // แสดงเฉพาะข้อมูลการนอนตามที่ระบุ

      // สร้างปุ่มยืนยัน
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`sleep_confirm_${pet._id}`)
            .setLabel('ให้นอน')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`sleep_cancel_${pet._id}`)
            .setLabel('ยกเลิก')
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
          .setTitle('❌ ยกเลิกการเข้านอน')
          .setDescription('การเข้านอนถูกยกเลิกแล้ว')
          .setColor('#ff0000')

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
          const embed = new EmbedBuilder()
            .setTitle('ไม่สามารถเริ่มการเข้านอนได้')
            .setDescription(String(sleepResult.message || 'ไม่ทราบสาเหตุ'))
            .setColor('#ff6961');
          await interaction.update({ embeds: [embed], components: [] });
          return;
        }

        // อัปเดต cooldown
        trainCooldowns.set(interaction.user.id, Date.now());

        // อัปเดต fire streak
        await updateFireStreak(interaction.guild.id, interaction.user.id);

        // ดึงข้อมูลสัตว์เลี้ยงที่อัปเดตแล้ว
        const updated = await GPet.findById(petId);

        // คำนวณ EXP ที่จะได้หลังตื่น (จำลอง)
        const expAfterSleep = Number(updated.exp || 0) + 4; // Sleep ให้ EXP +4
        let level = Number(updated.level || 1);
        let nextexp = Number(updated.nextexp || Math.floor(level * level * 1.5));
        let willLevelUp = expAfterSleep >= nextexp;

        // สร้าง embed
        const embed = new EmbedBuilder()
        .setAuthor({ name: `${updated.name} กำลังนอน`, iconURL: "https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/icon-sleep.png" })
        .setColor('#c9ce93')
          .setThumbnail('https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/thumbnail/sleep.png')
          .setTimestamp();

        // แสดงข้อมูลการนอน
        embed.addFields({
          name: "ข้อมูลการนอน",
          value: `**เวลานอน:** ${sleepResult.duration} นาที\n**เวลาตื่น:** <t:${Math.floor(sleepResult.wakeUpTime.getTime() / 1000)}:R>`,
          inline: false
        });

        // แสดงค่าสถานะตามรูปแบบที่ต้องการ (แสดงค่าหลังตื่นแบบคาดการณ์)
        const fatigueAfterSleep = 0;
        const fatigueDelta = -Number(updated.fatigue || 0);
        embed.addFields({
          name: "ค่าสถานะ",
          value: `<:fatigue:1424394380604870727> **ความล้า:** ${fatigueAfterSleep}/20 (${fatigueDelta})\n<:exp:1424394377555607592> **EXP :** ${updated.exp}/${nextexp} (+4)` + (willLevelUp ? `\n✨ **จะเลเวลอัปเมื่อตื่น!**` : ''),
          inline: false
        });

        // Footer
        embed.setFooter({ 
          text: `สัตว์เลี้ยงเริ่มนอนแล้ว • จะตื่นในอีก ${sleepResult.duration} นาที` 
        });

        await interaction.update({ 
          embeds: [embed], 
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