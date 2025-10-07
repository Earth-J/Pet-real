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
const playCooldowns = new Map();
const PLAY_COOLDOWN = 2 * 60 * 1000; // 2 minutes cooldown

const PET_ASSET_BASE_URL = (process.env.PET_ASSET_BASE_URL || 'https://cdn.kitsxkorn.xyz').replace(/\/$/, '');
const PET_ASSET_PATH_PREFIX = (process.env.PET_ASSET_PATH_PREFIX || '').replace(/^\/+|\/+$/g, '');
function buildCdnUrl(...segs) { const parts = [PET_ASSET_BASE_URL]; if (PET_ASSET_PATH_PREFIX) parts.push(PET_ASSET_PATH_PREFIX); for (const s of segs) { const v = String(s || '').trim().replace(/^\/+|\/+$/g, ''); if (v) parts.push(v);} return parts.join('/'); }
function cdnPetStaticUrl(state, type) { return buildCdnUrl('pet', state, `${type}.png`); }
async function makePetThumbAttachment(petDoc, state, poseKey) {
  try {
    // ใช้ GIF จากฐานข้อมูลก่อน
    const dbGif = String(petDoc?.spriteGifUrl || '').trim();
    if (dbGif) {
      try {
        const buf = await fetchBuffer(dbGif);
        if (Buffer.isBuffer(buf)) return new AttachmentBuilder(buf, { name: 'pet_thumb.gif' });
      } catch (_) {}
    }
    const queue = getRenderQueue();
    const size = { width: 96, height: 96 };
    const staticUrl = cdnPetStaticUrl(state, petDoc.type);
    const bounce = [0, -2, 0, 2, 0, 0];
    const frames = bounce.map(dy => ({ url: staticUrl, draw: { x: 20, y: 15 + dy, w: 56, h: 60 } }));
    const payload = { guild: 'g', user: 'u', size, format: 'gif', gifOptions: { delayMs: parseInt(process.env.PET_GIF_DELAY_MS || '210'), repeat: 0, quality: parseInt(process.env.PET_GIF_QUALITY || '10'), transparent: true }, layers: [{ type: 'pet_gif_frames', frames }] };
    const { jobId } = await queue.enqueue(payload);
    const result = await queue.waitForResult(jobId);
    const buf = await fetchBuffer(result.url);
    return new AttachmentBuilder(buf, { name: 'pet_thumb.gif' });
  } catch (_) { return null; }
}

// ตรวจสอบ cooldown
function checkCooldown(userId) {
  const now = Date.now();
  const lastUsed = playCooldowns.get(userId);
  
  if (lastUsed && (now - lastUsed) < PLAY_COOLDOWN) {
    const remaining = Math.ceil((PLAY_COOLDOWN - (now - lastUsed)) / 1000);
    return remaining;
  }
  
  return 0;
}

module.exports = {
  name: ["สัตว์เลี้ยง", "เล่น"],
  description: "เล่นกับสัตว์เลี้ยง (คูลดาวน์ 2 นาที)",
  category: "Pet",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    // ตรวจสอบ cooldown
    const cooldownRemaining = checkCooldown(interaction.user.id);
    if (cooldownRemaining > 0) {
      return interaction.editReply(`⏰ สัตว์เลี้ยงของคุณพักเหนื่อยอยู่ รอ **${cooldownRemaining} วินาที** `);
    }

    await withUserLock(interaction.guild.id, interaction.user.id, async () => {
      const pet = await GPet.findOne({ guild: interaction.guild.id, user: interaction.user.id }).lean();
      if (!pet) {
        const embedNoPet = new EmbedBuilder()
          .setTitle('ไม่พบสัตว์เลี้ยง')
          .setDescription('คุณยังไม่มีสัตว์เลี้ยง')
          .setColor('#ff6961');
        return interaction.editReply({ embeds: [embedNoPet] });
      }

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

      // ตรวจสอบว่าสัตว์กำลังนอนอยู่หรือไม่
      if (petSleepSystem.isPetSleeping(pet._id)) {
        const remainingMinutes = petSleepSystem.getRemainingSleepTime(pet._id);
        const embedWarn = new EmbedBuilder()
          .setTitle('กำลังนอนอยู่')
          .setDescription(`😴 สัตว์เลี้ยงกำลังนอนอยู่ ต้องรออีก **${remainingMinutes} นาที** ก่อนจะตื่น`)
          .setColor('#ff6961');
        return interaction.editReply({ embeds: [embedWarn] });
      }

      // ตรวจสอบความเหนื่อยล้า
      if (before.fatigue >= 20) {
        const embedFat = new EmbedBuilder()
          .setTitle('เหนื่อยล้าเกินไป')
          .setDescription(`😴 **${pet.name} เหนื่อยล้ามากเกินไป!**\nสัตว์เลี้ยงต้องนอนพักผ่อนก่อน ใช้คำสั่ง \`/สัตว์เลี้ยง เข้านอน\``)
          .setColor('#ff6961');
        return interaction.editReply({ embeds: [embedFat] });
      }

      // เตือนถ้าเหนื่อยมาก (แต่ยังทำได้)
      let fatigueWarning = '';
      if (before.fatigue >= 15 && before.fatigue < 20) {
        fatigueWarning = '\n⚠️ **คำเตือน:** สัตว์เลี้ยงเริ่มเหนื่อยล้ามาก ควรให้นอนพักผ่อนเร็วๆ นี้!';
      }

      // ใช้ระบบพฤติกรรมสัตว์เลี้ยงใหม่
      const result = await petBehaviorSystem.processPlayerAction(pet._id, 'play');
      
      if (!result.success) {
        const embedErr = new EmbedBuilder()
          .setTitle('เกิดข้อผิดพลาด')
          .setDescription(`รายละเอียด: ${result.error || 'ไม่ทราบสาเหตุ'}`)
          .setColor('#ff6961');
        return interaction.editReply({ embeds: [embedErr] });
      }

      // อัปเดต cooldown
      playCooldowns.set(interaction.user.id, Date.now());

      // อัปเดต fire streak
      await updateFireStreak(interaction.guild.id, interaction.user.id);

      // สร้าง embed
      const embed = new EmbedBuilder()
      .setAuthor({ name: `กำลังเล่นกับ ${pet.name}`, iconURL: "https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/icon-sleep.png" })
        .setColor('#e8f093')
        .setThumbnail('https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/thumbnail/play.png')
        .setTimestamp();

      // แสดงปฏิกิริยาของสัตว์เลี้ยง
      if (result.reactions && result.reactions.length > 0) {
        embed.addFields({
          name: "💬 ปฏิกิริยาของสัตว์เลี้ยง",
          value: result.reactions.join('\n') + fatigueWarning,
          inline: false
        });
      }

      // แสดงการเปลี่ยนแปลงของค่า (สไตล์เดียวกับ Walk/Sleep)
      const newStats = result.stats;
      const fmt = (n) => (Number.isInteger(n) ? `${n}` : `${Number(n).toFixed(1)}`);
      const sign = (d) => (d > 0 ? `+${fmt(d)}` : `${fmt(d)}`);
      const lines = [];
      // ความสกปรก
      if (before.dirtiness !== newStats.dirtiness) {
        const d = newStats.dirtiness - before.dirtiness;
        lines.push(`<:dirtiness:1424394365677342741> **ความสกปรก:** ${fmt(newStats.dirtiness)}/20 (${sign(d)})`);
      }
      // ความล้า
      if (before.fatigue !== newStats.fatigue) {
        const d = newStats.fatigue - before.fatigue;
        lines.push(`<:fatigue:1424394380604870727> **ความล้า:** ${fmt(newStats.fatigue)}/20 (${sign(d)})`);
      }
      // ความเอ็นดู
      if (before.affection !== newStats.affection) {
        const d = newStats.affection - before.affection;
        lines.push(`<:love:1424394386497601687> **ความเอ็นดู:** ${fmt(newStats.affection)}/20 (${sign(d)})`);
      }
      // ความอิ่ม
      if (before.fullness !== newStats.fullness) {
        const d = newStats.fullness - before.fullness;
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
        text: `การเล่นเสร็จสิ้น • ${pet.name} รู้สึกดีขึ้น!` 
      });

      await interaction.editReply({ embeds: [embed] });
      if (result.leveledUp) {
        try {
          const lvlEmbed = new EmbedBuilder()
            .setColor('#c9ce93')
            .setTitle('🎉 Level Up!')
            .setDescription(`${interaction.user} สัตว์เลี้ยงเลเวลอัปเป็นเลเวล **${result.level}**!`);
          await interaction.followUp({ embeds: [lvlEmbed], ephemeral: false });
        } catch {}
      }
    });
  }
};
