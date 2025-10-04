const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
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
const cleanCooldowns = new Map();
const CLEAN_COOLDOWN = 3 * 60 * 1000; // 3 minutes cooldown

// CDN helpers (เลียนแบบจากคำสั่งแสดงการ์ด)
const PET_ASSET_BASE_URL = (process.env.PET_ASSET_BASE_URL || 'https://cdn.kitsxkorn.xyz').replace(/\/$/, '');
const PET_ASSET_PATH_PREFIX = (process.env.PET_ASSET_PATH_PREFIX || '').replace(/^\/+|\/+$/g, '');
function buildCdnUrl(...segs) {
  const parts = [PET_ASSET_BASE_URL];
  if (PET_ASSET_PATH_PREFIX) parts.push(PET_ASSET_PATH_PREFIX);
  for (const s of segs) {
    const v = String(s || '').trim().replace(/^\/+|\/+$/g, '');
    if (v) parts.push(v);
  }
  return parts.join('/');
}
function cdnPetStaticUrl(state, type) { return buildCdnUrl('pet', state, `${type}.png`); }

async function makePetThumbAttachment(petDoc, state, poseKey) {
  try {
    // ใช้ GIF จากฐานข้อมูลก่อน ถ้ามี ให้โหลดเป็น Attachment เลย
    const dbGif = String(petDoc?.spriteGifUrl || '').trim();
    if (dbGif) {
      try {
        const buf = await fetchBuffer(dbGif);
        if (Buffer.isBuffer(buf)) return new AttachmentBuilder(buf, { name: 'pet_thumb.gif' });
      } catch (_) { /* ถ้าโหลดไม่ได้ ค่อยเรนเดอร์ใหม่ */ }
    }

    const queue = getRenderQueue();
    const size = { width: 96, height: 96 };
    const staticUrl = cdnPetStaticUrl(state, petDoc.type);
    const bounce = [0, -2, 0, 2, 0, 0];
    const frames = bounce.map(dy => ({ url: staticUrl, draw: { x: 20, y: 15 + dy, w: 56, h: 60 } }));
    const payload = {
      guild: 'g', user: 'u', size, format: 'gif',
      gifOptions: { delayMs: parseInt(process.env.PET_GIF_DELAY_MS || '210'), repeat: 0, quality: parseInt(process.env.PET_GIF_QUALITY || '10'), transparent: true },
      layers: [{ type: 'pet_gif_frames', frames }]
    };
    const { jobId } = await queue.enqueue(payload);
    const result = await queue.waitForResult(jobId);
    const buf = await fetchBuffer(result.url);
    return new AttachmentBuilder(buf, { name: 'pet_thumb.gif' });
  } catch (_) {
    return null;
  }
}

// ตรวจสอบ cooldown
function checkCooldown(userId) {
  const now = Date.now();
  const lastUsed = cleanCooldowns.get(userId);
  
  if (lastUsed && (now - lastUsed) < CLEAN_COOLDOWN) {
    const remaining = Math.ceil((CLEAN_COOLDOWN - (now - lastUsed)) / 1000);
    return remaining;
  }
  
  return 0;
}

module.exports = {
  name: ["สัตว์เลี้ยง", "ทำความสะอาด"],
  description: "Clean your pet. (3 minute cooldown)",
  category: "Pet",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    // ตรวจสอบ cooldown
    const cooldownRemaining = checkCooldown(interaction.user.id);
    if (cooldownRemaining > 0) {
      return interaction.editReply(`⏰ คุณต้องรอ **${cooldownRemaining} วินาที** ก่อนที่จะทำความสะอาดสัตว์เลี้ยงได้อีกครั้ง`);
    }

    await withUserLock(interaction.guild.id, interaction.user.id, async () => {
      const pet = await GPet.findOne({ guild: interaction.guild.id, user: interaction.user.id }).lean();
      if (!pet) return interaction.editReply("คุณยังไม่มีสัตว์เลี้ยง");

      const clamp = (n, lo = 0, hi = 20) => Math.max(lo, Math.min(hi, Number(n || 0)));
      const fmtDelta = (label, before, after, max = 20) => {
        const d = Number(after) - Number(before);
        if (d === 0) return null;
        const sign = d >= 0 ? `+${d}` : `${d}`;
        return `${label}: ${after} / ${max} (\`${sign}\`)`;
      };

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

      // ใช้ระบบพฤติกรรมสัตว์เลี้ยงใหม่
      const result = await petBehaviorSystem.processPlayerAction(pet._id, 'clean');
      
      if (!result.success) {
        return interaction.editReply({ content: `เกิดข้อผิดพลาด: ${result.error}` });
      }

      // อัปเดต cooldown
      cleanCooldowns.set(interaction.user.id, Date.now());

      // อัปเดต fire streak
      await updateFireStreak(interaction.guild.id, interaction.user.id);

      // ดึงข้อมูลสัตว์เลี้ยงที่อัปเดตแล้ว
      const updated = await GPet.findById(pet._id);

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
        exp = diff;
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
        .setTitle(`🧼 ทำความสะอาด ${pet.name}`)
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
      const newStats = result.stats;
      let changesText = '';
      if (before.fatigue !== newStats.fatigue) {
        const change = newStats.fatigue - before.fatigue;
        changesText += `**ความล้า:** ${before.fatigue} → ${newStats.fatigue} (${change > 0 ? '+' : ''}${change})\n`;
      }
      if (before.affection !== newStats.affection) {
        const change = newStats.affection - before.affection;
        changesText += `**ความเอ็นดู:** ${before.affection} → ${newStats.affection} (${change > 0 ? '+' : ''}${change})\n`;
      }
      if (before.fullness !== newStats.fullness) {
        const change = newStats.fullness - before.fullness;
        changesText += `**ความอิ่ม:** ${before.fullness} → ${newStats.fullness} (${change > 0 ? '+' : ''}${change})\n`;
      }
      if (before.dirtiness !== newStats.dirtiness) {
        const change = newStats.dirtiness - before.dirtiness;
        changesText += `**ความสกปรก:** ${before.dirtiness} → ${newStats.dirtiness} (${change > 0 ? '+' : ''}${change})\n`;
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

      // แสดงข้อมูล EXP และ Level
      embed.addFields({
        name: "📈 ประสบการณ์",
        value: `**EXP:** ${exp}/${nextexp} (+1)\n${leveledUp ? `**เลเวลอัป!** → เลเวล ${level}` : ''}`,
        inline: false
      });

      // Footer
      embed.setFooter({ 
        text: `การทำความสะอาดเสร็จสิ้น • ${pet.name} รู้สึกดีขึ้น!` 
      });

      const files = [];
      if (thumbAtt) { 
        files.push(thumbAtt); 
        embed.setThumbnail('attachment://pet_thumb.gif'); 
      }

      await interaction.editReply({ embeds: [embed], files });
    });
  }
};