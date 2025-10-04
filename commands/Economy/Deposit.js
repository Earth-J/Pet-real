const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const GProfile = require("../../settings/models/profile.js");

module.exports = {
    name: ["ฝากเงิน"],
    description: "ฝากเงินเข้าธนาคาร",
    category: "Economy",
    options: [
        {
            name: "จำนวนเงิน",
            type: ApplicationCommandOptionType.Integer,
            description: "จำนวนเงินที่ต้องการฝาก",
            required: true,
            minValue: 1
        }
    ],
    run: async (client, interaction) => {
        const user = interaction.user;
        const amount = interaction.options.getInteger("จำนวนเงิน");

        // อัปเดตแบบอะตอมมิก: สำเร็จเฉพาะเมื่อ money เพียงพอ
        const res = await GProfile.updateOne(
            { guild: interaction.guild.id, user: user.id, money: { $gte: amount } },
            { $inc: { money: -amount, bank: amount } }
        );

        if (!res || res.modifiedCount === 0) {
            return interaction.reply({ content: `คุณมีเงินในกระเป๋าไม่เพียงพอ`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setDescription(`ฝากเงินจำนวน **${amount}** <:706219192923455549:1312400668056748032> เข้าธนาคารสำเร็จ!`)
            .setColor(client.color)
        return interaction.reply({ embeds: [embed] });
    }
}; 