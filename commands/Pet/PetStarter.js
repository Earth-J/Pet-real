const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const GPet = require("../../settings/models/pet.js");
const GProfile = require("../../settings/models/profile.js");
const GInv = require("../../settings/models/inventory.js");
const Canvas = require("@napi-rs/canvas");
const { pet } = require("../../settings/pet.js");

// Cooldown system
const starterCooldowns = new Map();
const STARTER_COOLDOWN = 30 * 60 * 1000; // 30 minutes cooldown

// ตรวจสอบ cooldown
function checkCooldown(userId) {
    const now = Date.now();
    const lastUsed = starterCooldowns.get(userId);
    
    if (lastUsed && (now - lastUsed) < STARTER_COOLDOWN) {
        const remaining = Math.ceil((STARTER_COOLDOWN - (now - lastUsed)) / 1000);
        return remaining;
    }
    
    return 0;
}

// แผนที่ประเภทสัตว์ → ลิงก์ GIF idle บน CDN
const IDLE_GIF_BY_TYPE = {
  cat: 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/cat-idle.gif',
  dog: 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/dog-idle.gif',
};
function resolveIdleGifUrl(petType) {
  return IDLE_GIF_BY_TYPE[String(petType || '').toLowerCase()] || '';
}

module.exports = {
  name: ["รับสัตว์เลี้ยง"],
  description: "เลือกสัตว์เริ่มต้นฟรี (คูลดาวน์ 30 นาที)",
  category: "Pet",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    // ตรวจสอบ cooldown
    const cooldownRemaining = checkCooldown(interaction.user.id);
    if (cooldownRemaining > 0) {
        return interaction.editReply(`⏰ คุณต้องรอ **${cooldownRemaining} วินาที** ก่อนที่จะสร้างสัตว์เลี้ยงใหม่ได้อีกครั้ง`);
    }

    const loadingEmbed = new EmbedBuilder()
      .setTitle('กำลังโหลด')
      .setDescription('กำลังโหลดสัตว์เลี้ยง...')
      .setColor('#cccccc');
    const msg = await interaction.editReply({ embeds: [loadingEmbed] });

    const hasPet = await GPet.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    if (hasPet) {
      const embedHasPet = new EmbedBuilder()
        .setTitle('มีสัตว์เลี้ยงอยู่แล้ว')
        .setDescription('คุณมีสัตว์เลี้ยงแล้ว!')
        .setColor('#ffcc00');
      return msg.edit({ embeds: [embedHasPet] });
    }

    const object = Object.values(pet);

    const row = new ActionRowBuilder().addComponents([
      new StringSelectMenuBuilder()
        .setCustomId("starter_pets")
        .setPlaceholder(`เลือกสัตว์เริ่มต้นฟรี`)
        .setMaxValues(1)
        .setMinValues(1)
        .setOptions(object.map(key => new StringSelectMenuOptionBuilder()
          .setLabel(`${toOppositeCase(key.name)} | เลเวลเริ่มต้นที่ ${key.level}`)
          .setValue(key.type)
        ))
    ]);

    const canvas = Canvas.createCanvas(450, 300);
    const ctx = canvas.getContext("2d");
    const shop = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/select-pet.png");
    ctx.drawImage(shop, 0, 0, canvas.width, canvas.height);
    const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `select.png` })

    const embed = new EmbedBuilder().setImage("attachment://select.png").setColor(client.color);
    await msg.edit({ content: " ", embeds: [embed], components: [row], files: [attc] });

    const filter = (m) => m.user.id === interaction.user.id;
    const collector = await msg.createMessageComponentCollector({ filter, time: 300000 });
    const nonOwnerCollector = msg.createMessageComponentCollector({ filter: (x) => x.user.id !== interaction.user.id, time: 300000 });
    nonOwnerCollector.on('collect', async (menu) => { 
        try { 
            await menu.reply({ content: "เมนูนี้สำหรับผู้ที่เรียกคำสั่งเท่านั้น", ephemeral: true }); 
        } catch {} 
    });

    collector.on('collect', async (menu) => {
      if (!menu.isStringSelectMenu()) return;
      if (menu.customId !== "starter_pets") return;

      // ห้าม deferUpdate ก่อน showModal เพราะจะทำให้ interaction ถูกตอบไปแล้ว
      const [directory] = menu.values;
      const item = pet.find(x => x.type === directory);
      if (!item) {
        const notFound = new EmbedBuilder()
          .setTitle('ไม่พบชนิดสัตว์นี้')
          .setColor('#ff6961');
        return menu.followUp({ embeds: [notFound], ephemeral: true });
      }

      // เปิดโมดอล ตั้งชื่อเล่น
      const modal = new ModalBuilder().setCustomId('pet_starter_modal').setTitle('ตั้งชื่อสัตว์เลี้ยง');
      const nameInput = new TextInputBuilder()
        .setCustomId('nickname')
        .setLabel('ชื่อเล่น (อังกฤษเท่านั้น, ≤10 ตัว)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(10)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
      await menu.showModal(modal);

      try {
        const submitted = await menu.awaitModalSubmit({
          filter: (i) => i.customId === 'pet_starter_modal' && i.user.id === interaction.user.id,
          time: 120000
        });

        const nickname = String(submitted.fields.getTextInputValue('nickname') || '').trim();
        const isValid = /^[A-Za-z]{1,10}$/.test(nickname);
        if (!isValid) {
          const invalid = new EmbedBuilder()
            .setTitle('ชื่อเล่นไม่ถูกต้อง')
            .setDescription('ชื่อเล่นต้องเป็นภาษาอังกฤษเท่านั้น และไม่เกิน 10 ตัวอักษร')
            .setColor('#ff6961');
          return submitted.reply({ embeds: [invalid], ephemeral: true });
        }

        // ไม่หักเงิน สร้างสัตว์พร้อม GIF URL และชื่อเล่น
        const idleGifUrl = resolveIdleGifUrl(item.type);
        const petnew = new GPet({
          guild: interaction.guild.id,
          user: interaction.user.id,
          type: item.type,
          name: nickname,
          price: 0,
          level: item.level,
          exp: item.exp,
          nextexp: item.nextexp,
          health: item.health,
          hungry: item.hungry,
          id: generateID(),
          spriteGifUrl: idleGifUrl
        });

        await petnew.save();
        
        // อัปเดต cooldown
        starterCooldowns.set(interaction.user.id, Date.now());
        
        const doneEphemeral = new EmbedBuilder()
          .setTitle('รับสัตว์เลี้ยงสำเร็จ')
          .setDescription(`รับสัตว์เลี้ยงเริ่มต้นสำเร็จ: ${toOppositeCase(item.name)} • ตั้งชื่อว่า "${nickname}"`)
          .setColor('#00cc66');
        await submitted.reply({ embeds: [doneEphemeral], ephemeral: true });

        const done = new EmbedBuilder().setColor(client.color).setDescription(`คุณได้รับสัตว์เลี้ยงฟรี: ${toOppositeCase(item.name)} \nตั้งชื่อเป็น: **${nickname}**`);
        await msg.edit({ embeds: [done], components: [], files: [] });
        collector.stop();
        try { nonOwnerCollector.stop(); } catch {}
      } catch (_) {
        const timeout = new EmbedBuilder()
          .setTitle('หมดเวลา')
          .setDescription('หมดเวลาตั้งชื่อ โปรดลองใหม่อีกครั้ง')
          .setColor('#ff6961');
        await msg.edit({ embeds: [timeout], components: [], files: [] });
        collector.stop();
        try { nonOwnerCollector.stop(); } catch {}
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        const timed = new EmbedBuilder().setDescription(`หมดเวลาแล้ว`).setColor(client.color);
        msg.edit({ embeds: [timed], components: [], files: [] });
      }
      try { nonOwnerCollector.stop(); } catch {}
    });
  }
}

function toOppositeCase(char) {
  return char.charAt(0).toUpperCase() + char.slice(1);
}

const crypto = require('crypto');
function generateID() {
  return crypto.randomBytes(16).toString('base64');
}; 
