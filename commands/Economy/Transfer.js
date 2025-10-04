const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const GProfile = require("../../settings/models/profile.js");
const mongoose = require("mongoose");

module.exports = {
    name: ["โอนเงิน"],
    description: "โอนเงินให้เพื่อน",
    category: "Economy",
    options: [
        {
            name: "ผู้ใช้",
            type: ApplicationCommandOptionType.User,
            description: "เลือกผู้รับเงิน",
            required: true,
        },
        {
            name: "จำนวนเงิน",
            type: ApplicationCommandOptionType.Integer,
            description: "จำนวนเงินที่ต้องการโอน",
            required: true,
            minValue: 1
        }
    ],
    run: async (client, interaction) => {
        const sender = interaction.user;
        const receiver = interaction.options.getUser("ผู้ใช้");
        const amount = interaction.options.getInteger("จำนวนเงิน");
        if (receiver.bot) return interaction.reply({ content: "ไม่สามารถโอนเงินให้บอทได้", ephemeral: true });
        if (receiver.id === sender.id) return interaction.reply({ content: "ไม่สามารถโอนเงินให้ตัวเองได้", ephemeral: true });

        const guildId = interaction.guild.id;

        // พยายามใช้ธุรกรรม (ถ้ารองรับ replica set)
        let usedTransaction = false;
        let session = null;
        try {
            session = await mongoose.startSession();
            await session.withTransaction(async () => {
                const decRes = await GProfile.updateOne(
                    { guild: guildId, user: sender.id, money: { $gte: amount } },
                    { $inc: { money: -amount } },
                    { session }
                );
                if (!decRes || decRes.modifiedCount === 0) {
                    throw new Error("INSUFFICIENT_FUNDS");
                }
                await GProfile.updateOne(
                    { guild: guildId, user: receiver.id },
                    {
                        $inc: { money: amount },
                        $setOnInsert: { tokens: 0, bank: 0, level: 0, inventory: 100 }
                    },
                    { upsert: true, session }
                );
            });
            usedTransaction = true;
        } catch (err) {
            if (usedTransaction) {
                if (err && err.message === "INSUFFICIENT_FUNDS") {
                    return interaction.reply({ content: `คุณมีเงินไม่เพียงพอ`, ephemeral: true });
                }
                return interaction.reply({ content: `เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง`, ephemeral: true });
            }
            // ไม่มีธุรกรรม (เช่น ไม่ได้รันใน replica set) → ใช้ 2-step พร้อมเงื่อนไขและพยายามคืนเงินหากล้มเหลว
            const decRes = await GProfile.updateOne(
                { guild: guildId, user: sender.id, money: { $gte: amount } },
                { $inc: { money: -amount } }
            );
            if (!decRes || decRes.modifiedCount === 0) {
                return interaction.reply({ content: `คุณมีเงินไม่เพียงพอ`, ephemeral: true });
            }
            try {
                await GProfile.updateOne(
                    { guild: guildId, user: receiver.id },
                    {
                        $inc: { money: amount },
                        $setOnInsert: { tokens: 0, bank: 0, level: 0, inventory: 100 }
                    },
                    { upsert: true }
                );
            } catch (e) {
                await GProfile.updateOne(
                    { guild: guildId, user: sender.id },
                    { $inc: { money: amount } }
                );
                return interaction.reply({ content: `เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง`, ephemeral: true });
            }
        } finally {
            if (session) {
                try { await session.endSession(); } catch {}
            }
        }

        const embed = new EmbedBuilder()
            .setDescription(`โอนเงินจำนวน **${amount}** <:706219192923455549:1312400668056748032> ให้ <@${receiver.id}> สำเร็จ!`)
            .setColor(client.color)
        return interaction.reply({ embeds: [embed] });
    }
}; 