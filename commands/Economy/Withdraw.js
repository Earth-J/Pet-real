const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const GProfile = require("../../settings/models/profile.js");

module.exports = {
    name: ["ถอนเงิน"],
    description: "ถอนเงินออกจากธนาคาร",
    category: "Economy",
    options: [
        {
            name: "จำนวนเงิน",
            type: ApplicationCommandOptionType.Integer,
            description: "จำนวนเงินที่ต้องการถอน",
            required: true,
            minValue: 1
        }
    ],
    run: async (client, interaction) => {
        const user = interaction.user;
        const amount = interaction.options.getInteger("จำนวนเงิน");

        // อัปเดตแบบอะตอมมิก: สำเร็จเฉพาะเมื่อ bank เพียงพอ
        const res = await GProfile.updateOne(
            { guild: interaction.guild.id, user: user.id, bank: { $gte: amount } },
            { $inc: { bank: -amount, money: amount } }
        );

        if (!res || res.modifiedCount === 0) {
            return interaction.reply({ content: `คุณมีเงินในธนาคารไม่เพียงพอ`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setDescription(`ถอนเงินจำนวน **${amount}** <:706219192923455549:1312400668056748032> ออกจากธนาคารสำเร็จ!`)
            .setColor(client.color)
        return interaction.reply({ embeds: [embed] });
    }
}; 