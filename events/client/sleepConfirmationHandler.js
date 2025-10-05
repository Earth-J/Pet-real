const { Events } = require('discord.js');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // จัดการปุ่มยืนยันการนอน
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('sleep_confirm_') || interaction.customId.startsWith('sleep_cancel_')) {
        try {
          const petId = interaction.customId.split('_')[2];
          const action = interaction.customId.startsWith('sleep_confirm_') ? 'confirm' : 'cancel';
          
          // Import PetSleep command
          const PetSleepCommand = require('../../commands/Pet/PetSleep');
          
          // เรียกใช้ฟังก์ชันประมวลผลการยืนยัน
          await PetSleepCommand.processSleepConfirmation(interaction, petId, action);
          
        } catch (error) {
          console.error('Error handling sleep confirmation button:', error);
          
          const errorEmbed = new EmbedBuilder()
            .setTitle('❌ เกิดข้อผิดพลาด')
            .setDescription('เกิดข้อผิดพลาดในการประมวลผลการยืนยัน กรุณาลองใหม่อีกครั้ง')
            .setColor('#ff0000')
            .setTimestamp();

          if (interaction.replied || interaction.deferred) {
            await interaction.editReply({ 
              embeds: [errorEmbed], 
              components: [] 
            });
          } else {
            await interaction.reply({ 
              embeds: [errorEmbed], 
              components: [],
              ephemeral: true
            });
          }
        }
      }
    }
  },
};


