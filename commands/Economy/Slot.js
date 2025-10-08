const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const crypto = require("crypto");
const GProfile = require("../../settings/models/profile.js");

// ---- CONFIG ----
const MIN_BET = 10;
const MAX_BET = 100000;
const SPIN_FRAMES = 4;     // จำนวนเฟรมแอนิเมชัน (สุ่มผลไม้)
const FRAME_DELAY = 450;   // ms/เฟรม
const REVEAL_DELAY = 500;  // ms หลังแอนิเมชันก่อนแสดงผลจริง

// แก้จากจ่ายคูณคงที่ -> เป็นสัดส่วนของ payout3 ของสัญลักษณ์ที่เป็นคู่
const PAIR_RATE = 0.50;    // คู่ได้ 25% ของอัตราจ่ายเต็ม (ปรับได้)

const USER_LOCK = new Set(); // ป้องกันผู้ใช้กดซ้อน

// helper: สุ่มจำนวนเต็ม [0, n)
function randInt(n) {
  return crypto.randomInt(0, n);
}

module.exports = {
  name: ["สล็อต"],
  description: "เล่นเกมสล็อต เสี่ยงโชคด้วยเงินในกระเป๋า",
  category: "Economy",
  options: [
    {
      name: "จำนวนเงิน",
      type: ApplicationCommandOptionType.Integer,
      description: "จำนวนเงินที่ต้องการเดิมพัน",
      required: true,
      minValue: MIN_BET, // ให้ตรงกับ footer/config
    }
  ],
  run: async (client, interaction) => {
    const user = interaction.user;
    const guildId = interaction.guild.id;

    // Defer เร็วที่สุด เพื่อกัน timeout 3s
    await interaction.deferReply();

    // --------- LOCK 防重入 ---------
    if (USER_LOCK.has(user.id)) {
      return interaction.editReply({
        content: "⏳ กำลังดำเนินการสปินก่อนหน้าอยู่ รอสักครู่แล้วลองใหม่อีกครั้งนะ",
      });
    }
    USER_LOCK.add(user.id);

    try {
      const bet = interaction.options.getInteger("จำนวนเงิน");

      // ตรวจสอบ min/max bet
      if (bet < MIN_BET || bet > MAX_BET) {
        USER_LOCK.delete(user.id);
        return interaction.editReply({
          content: `เดิมพันต้องอยู่ระหว่าง **${MIN_BET}** ถึง **${MAX_BET}** เท่านั้น`,
        });
      }

      // ตารางสัญลักษณ์ + น้ำหนัก + จ่าย (สามตัวเหมือน)
      const symbols = [
        // Fruits (common)
        { emoji: "<:cherry:1424813850565283851>",     weight: 35, payout3: 2 },
        { emoji: "<:lemon:1424813878725841036>",      weight: 25, payout3: 3 },
        { emoji: "<:grape:1424813863873941524>",      weight: 20, payout3: 5 },
        { emoji: "<:apple:1424813838297202728>",      weight: 28, payout3: 3 },
        { emoji: "<:orange:1424813891124199535>",     weight: 28, payout3: 2 },
        { emoji: "<:mango:1424813887261245510>",      weight: 26, payout3: 3 },
        { emoji: "<:watermelon:1424813898489397268>", weight: 24, payout3: 3 },

        // Hearts / Love
        { emoji: "<:heart:1424813868877877351>",      weight: 18, payout3: 5 },
        { emoji: "<:love:1424394386497601687>",       weight: 16, payout3: 6 },

        // Coins / Misc
        { emoji: "<:coin:1424813855145721907>",       weight: 14, payout3: 4 },
        { emoji: "<:question:1424813894823579670>",   weight: 12, payout3: 6 },

        // Lucky symbols
        { emoji: "<:horseshoe:1424813873621630976>",  weight: 14, payout3: 8 },
        { emoji: "<:bell:1424813845624651938>",       weight: 12, payout3: 10 },
        { emoji: "<:bar:1424813841275027606>",        weight: 10, payout3: 12 },
        { emoji: "<:lucky:1424813883280851034>",      weight: 9,  payout3: 15 },
        { emoji: "<:diamond:1424813858865942558>",    weight: 8,  payout3: 25 },
        { emoji: "<:7_:1424813834266476685>",         weight: 5,  payout3: 50 },
      ];

      const totalWeight = symbols.reduce((s, x) => s + x.weight, 0);

      const spinOnce = () => {
        let r = randInt(totalWeight);
        for (const s of symbols) {
          if ((r -= s.weight) < 0) return s;
        }
        return symbols[symbols.length - 1];
      };

      // หักเงินแบบอะตอมมิก
      const decRes = await GProfile.updateOne(
        { guild: guildId, user: user.id, money: { $gte: bet } },
        { $inc: { money: -bet } }
      );

      if (!decRes || decRes.modifiedCount === 0) {
        USER_LOCK.delete(user.id);
        return interaction.editReply({ content: `ยอดเงินไม่เพียงพอสำหรับเดิมพันนี้` });
      }

      const fruitEmojis = symbols.map(s => s.emoji);
      const randomFruit = () => fruitEmojis[randInt(fruitEmojis.length)];
      const makeRandomGrid = () => [
        [randomFruit(), randomFruit(), randomFruit()],
        [randomFruit(), randomFruit(), randomFruit()],
        [randomFruit(), randomFruit(), randomFruit()],
      ];

      const spinnerFrames = Array.from({ length: SPIN_FRAMES }, makeRandomGrid);

      const renderBracketGrid = (rows, opts = {}) => {
        const withArrow = !!opts.withArrow;
        const multiplierText = opts.multiplierText || null;
        const emptyPrefix = '<:emptyspace:1424814102651469914>';
        const arrowPrefix = '<:DoubleArrowRight:1424723922145902692>';
        return rows.map((r, idx) => {
          const line = `[ ${r[0]} ${r[1]} ${r[2]} ]`;
          if (withArrow && idx === 1) {
            const mult = multiplierText ? `  ${multiplierText}` : "";
            return `${arrowPrefix} ${line}${mult}`;
          }
          return `${emptyPrefix} ${line}`;
        }).join("\n");
      };

      // ส่งเฟรมแรก
      const initial = new EmbedBuilder()
        .setAuthor({ name: `${user.username} | Slot`, iconURL: user.displayAvatarURL() })
        .setTitle(`สล็อตของคุณ • กำลังหมุน...`)
        .setDescription(renderBracketGrid(spinnerFrames[0], { withArrow: true }))
        .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/thumbnail-slot.png")
        .setColor(0x7289da)
        .setFooter({ text: `กำลังสุ่มผลลัพธ์...`, iconURL: interaction.user.displayAvatarURL() });

      await interaction.editReply({ embeds: [initial] });

      // เล่นแอนิเมชัน
      for (let i = 1; i < spinnerFrames.length; i++) {
        const frame = new EmbedBuilder()
          .setAuthor({ name: `${user.username} | Slot`, iconURL: user.displayAvatarURL() })
          .setTitle(`สล็อตของคุณ • กำลังหมุน...`)
          .setDescription(renderBracketGrid(spinnerFrames[i], { withArrow: true }))
          .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/thumbnail-slot.png")
          .setColor(0x7289da)
          .setFooter({ text: `กำลังสุ่มผลลัพธ์...`, iconURL: interaction.user.displayAvatarURL() });
        await new Promise(r => setTimeout(r, FRAME_DELAY));
        await interaction.editReply({ embeds: [frame] });
      }

      // สุ่มผลจริง 3x3 (เก็บ object ไว้ เพื่อรู้ payout3 ของผลลัพธ์จริง)
      const reelSpin = () => [spinOnce(), spinOnce(), spinOnce()];
      const grid = [reelSpin(), reelSpin(), reelSpin()];
      const displayRows = grid.map(row => row.map(s => s.emoji));

      // จ่ายเฉพาะแถวกลาง
      const lineBet = bet;
      const a = grid[1][0], b = grid[1][1], c = grid[1][2];

      let totalWin = 0;
      let appliedMultiplier = 0; // ตัวคูณรวมที่ใช้คำนวณ (ไว้โชว์)

      if (a.emoji === b.emoji && b.emoji === c.emoji) {
        // สามตัวเหมือน: ใช้ payout3 ของสัญลักษณ์นั้นตรง ๆ
        appliedMultiplier = a.payout3;
        totalWin = Math.floor(lineBet * appliedMultiplier);
      } else if (a.emoji === b.emoji || a.emoji === c.emoji || b.emoji === c.emoji) {
        // คู่: ใช้อัตราจ่ายเป็นสัดส่วนของ payout3 ตามสัญลักษณ์ที่เป็น "คู่"
        let pairSym = null;
        if (a.emoji === b.emoji) pairSym = a;
        else if (a.emoji === c.emoji) pairSym = a;
        else pairSym = b; // กรณีที่ b === c

        appliedMultiplier = pairSym.payout3 * PAIR_RATE;
        totalWin = Math.floor(lineBet * appliedMultiplier);
      }

      // จ่ายเงินถ้าได้
      if (totalWin > 0) {
        await GProfile.updateOne(
          { guild: guildId, user: user.id },
          { $inc: { money: totalWin } }
        );
      }

      // ดึง balance ล่าสุด
      const profile = await GProfile.findOne({ guild: guildId, user: user.id }, { money: 1 }).lean();
      const balance = profile?.money ?? 0;

      const net = totalWin - bet;
      const multiplierDisplay = `\`${(appliedMultiplier || 0).toFixed(2)}x\``;

      const description =
        `${renderBracketGrid(displayRows, { withArrow: true, multiplierText: multiplierDisplay })}\n\n` +
        `เดิมพัน: **${bet}** <:706219192923455549:1312400668056748032>\n` +
        `ชนะรวม: **${totalWin}** <:706219192923455549:1312400668056748032>\n` +
        `สุทธิ: **${net >= 0 ? `+${net}` : `${net}`}** <:706219192923455549:1312400668056748032>`;

      const result = new EmbedBuilder()
        .setAuthor({ name: `${user.username} | Slot`, iconURL: user.displayAvatarURL() })
        .setTitle(`สล็อตของคุณ • ผลลัพธ์`)
        .setDescription(description)
        .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/thumbnail-slot.png")
        .setColor(totalWin > 0 ? 0x43b581 : 0xf04747)
        .setFooter({ text: `ขั้นต่ำ: ⏣ ${MIN_BET} | สูงสุด: ⏣ 100,000 ` });

      await new Promise(r => setTimeout(r, REVEAL_DELAY));
      await interaction.editReply({ embeds: [result] });
    } catch (err) {
      // ถ้า error ระหว่างสปิน: คืนเงินให้ผู้เล่น (best-effort)
      try {
        await GProfile.updateOne(
          { guild: interaction.guild.id, user: interaction.user.id },
          { $inc: { money: + (interaction.options.getInteger("จำนวนเงิน") || 0) } }
        );
      } catch (e) {
        // เงียบไว้ ถ้าคืนไม่สำเร็จ
      }
      await interaction.editReply({
        content: "เกิดข้อผิดพลาดระหว่างการสปิน ระบบได้คืนเงินให้แล้ว หากยังไม่เข้าบัญชี โปรดติดต่อแอดมิน",
      });
      console.error("[Slot Error]", err);
    } finally {
      USER_LOCK.delete(interaction.user.id);
    }
  }
};
