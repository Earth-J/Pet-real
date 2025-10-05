const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require("discord.js");
const GPet = require("../../settings/models/pet.js");
const GProfile = require("../../settings/models/profile.js");

// Cooldown system
const renameCooldowns = new Map();
const RENAME_COOLDOWN = 5 * 60 * 1000; // 5 minutes cooldown
const RENAME_COST = 500;

// ตรวจสอบ cooldown
function checkCooldown(userId) {
    const now = Date.now();
    const lastUsed = renameCooldowns.get(userId);
    
    if (lastUsed && (now - lastUsed) < RENAME_COOLDOWN) {
        const remaining = Math.ceil((RENAME_COOLDOWN - (now - lastUsed)) / 1000);
        return remaining;
    }
    
    return 0;
}

module.exports = {
  name: ["สัตว์เลี้ยง", "เปลี่ยนชื่อ"],
  description: "เปลี่ยนชื่อสัตว์เลี้ยง (คูลดาวน์ 5 นาที, เสีย 500 บาท)",
  category: "Pet",
  run: async (client, interaction) => {
    // ตรวจสอบ cooldown
    const cooldownRemaining = checkCooldown(interaction.user.id);
    if (cooldownRemaining > 0) {
        return interaction.reply({ 
            content: `⏰ คุณต้องรอ **${cooldownRemaining} วินาที** ก่อนที่จะเปลี่ยนชื่อสัตว์เลี้ยงได้อีกครั้ง`, 
            ephemeral: true 
        });
    }

    // ต้องมีสัตว์ก่อน
    const pet = await GPet.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    if (!pet) {
      return interaction.reply({ content: "คุณยังไม่มีสัตว์เลี้ยง", ephemeral: true });
    }

    // ต้องมีเงินพอ
    const profile = await GProfile.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    if (!profile || (profile.money || 0) < RENAME_COST) {
      return interaction.reply({ content: `ต้องใช้เงิน ${RENAME_COST} ในการเปลี่ยนชื่อ (เงินไม่พอ)`, ephemeral: true });
    }

    // เปิดโมดอลให้กรอกชื่อใหม่
    const modal = new ModalBuilder().setCustomId('pet_rename_modal').setTitle('เปลี่ยนชื่อสัตว์เลี้ยง');
    const nameInput = new TextInputBuilder()
      .setCustomId('nickname')
      .setLabel('ชื่อใหม่ (อังกฤษเท่านั้น, ≤10 ตัว)')
      .setStyle(TextInputStyle.Short)
      .setMaxLength(10)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

    await interaction.showModal(modal);

    try {
      const submitted = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === 'pet_rename_modal' && i.user.id === interaction.user.id,
        time: 120000
      });

      const nickname = String(submitted.fields.getTextInputValue('nickname') || '').trim();
      const isValid = /^[A-Za-z]{1,10}$/.test(nickname);
      if (!isValid) {
        return submitted.reply({ content: 'ชื่อเล่นต้องเป็นภาษาอังกฤษเท่านั้น และไม่เกิน 10 ตัวอักษร', ephemeral: true });
      }

      // ตรวจเงินอีกรอบและหักเงินพร้อมบันทึกชื่อใหม่
      const freshProfile = await GProfile.findOne({ guild: interaction.guild.id, user: interaction.user.id });
      if (!freshProfile || (freshProfile.money || 0) < RENAME_COST) {
        return submitted.reply({ content: `ต้องใช้เงิน ${RENAME_COST} ในการเปลี่ยนชื่อ (เงินไม่พอ)`, ephemeral: true });
      }

      pet.name = nickname;
      freshProfile.money = (freshProfile.money || 0) - RENAME_COST;
      await Promise.all([pet.save(), freshProfile.save()]);

      // อัปเดต cooldown
      renameCooldowns.set(interaction.user.id, Date.now());

      const embed = new EmbedBuilder()
        .setColor(client.color)
        .setTitle('เปลี่ยนชื่อสัตว์เลี้ยงสำเร็จ')
        .setDescription(`ชื่อใหม่: **${nickname}**\nหักเงิน: ${RENAME_COST}`);

      await submitted.reply({ embeds: [embed], ephemeral: true });
    } catch (_) {
      // ผู้ใช้ปิดโมดอลหรือหมดเวลา
      // ไม่ต้องทำอะไรเพิ่ม เพื่อหลีกเลี่ยง error ซ้ำซ้อน
    }
  }
}; 