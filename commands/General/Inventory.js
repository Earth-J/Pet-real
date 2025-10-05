const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const GInv = require("../../settings/models/inventory.js");
const GProfile = require("../../settings/models/profile.js");

// Cooldown system
const inventoryCooldowns = new Map();
const INVENTORY_COOLDOWN = 30 * 1000; // 30 seconds cooldown

// ตรวจสอบ cooldown
function checkCooldown(userId) {
    const now = Date.now();
    const lastUsed = inventoryCooldowns.get(userId);
    
    if (lastUsed && (now - lastUsed) < INVENTORY_COOLDOWN) {
        const remaining = Math.ceil((INVENTORY_COOLDOWN - (now - lastUsed)) / 1000);
        return remaining;
    }
    
    return 0;
}

module.exports = {
    name: ["กระเป๋า"], // Base Commands! // Sub Commands!
    description: "กระเป๋าสำหรับเก็บของที่จำเป็น",
    category: "General",
    run: async (client, interaction) => {
        await interaction.deferReply({ ephemeral: false });

        // ตรวจสอบ cooldown
        const cooldownRemaining = checkCooldown(interaction.user.id);
        if (cooldownRemaining > 0) {
            const cooldownEmbed = new EmbedBuilder()
                .setColor(client.color)
                .setTitle("⏰ กรุณารอสักครู่")
                .setDescription(`คุณต้องรอ **${cooldownRemaining} วินาที** ก่อนที่จะเปิด inventory ได้อีกครั้ง`);
            return interaction.editReply({ embeds: [cooldownEmbed] });
        }

        const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });
        const profile = await GProfile.findOne({ guild: interaction.guild.id, user: interaction.user.id });

        if (!inv || !Array.isArray(inv.item)) {
            const emptyEmbed = new EmbedBuilder()
                .setColor(client.color)
                .setTitle("🎒 กระเป๋าว่างเปล่า")
                .setDescription("ยังไม่มีไอเทมในกระเป๋า");
            return interaction.editReply({ embeds: [emptyEmbed] });
        }

        // สรุปรายการแบบรวมของซ้ำ พร้อมนับจำนวนต่อประเภท
        const result = [...inv.item.reduce((mapByKey, item) => {
            const key = JSON.stringify([item.name, item.type]);
            if (!mapByKey.has(key)) mapByKey.set(key, { ...item, count: 0 });
            mapByKey.get(key).count++;
            return mapByKey;
        }, new Map()).values()];

        const sFood = [];
        const sCleaning = [];

        for (let i = 0; i < result.length; i++) {
            const type = result[i].type;
            if (type === "food") {
                sFood.push(`${result[i].emoji || "🍖"} ${toOppositeCase(result[i].name)} (x${result[i].count})`);
            } else if (type === "cleaning") {
                const used = result[i].used || 0;
                const capacity = result[i].capacity || 0;
                const status = used >= capacity ? "เต็ม" : "ว่าง";
                const emoji = used >= capacity ? "🔴" : "🟢";
                sCleaning.push(`${result[i].emoji || "🗑️"} ${toOppositeCase(result[i].name)} (x${result[i].count}) - ${emoji} ${status} (${used}/${capacity})`);
            }
        }

        const totalBackpack = `${inv.item.length}/${profile?.inventory ?? 0}`;

        // เมนูเลือกหมวด Pet
        const selectRow = new ActionRowBuilder().addComponents([
            new StringSelectMenuBuilder()
                .setCustomId("inv_select")
                .setPlaceholder("เลือกหมวดไอเทมที่จะดู")
                .setMaxValues(1)
                .setMinValues(1)
                .setOptions([
                    { label: "🐾 อาหารสัตว์เลี้ยง", description: "ดูอาหารที่ใช้กับสัตว์เลี้ยง", value: "pet" },
                    { label: "🗑️ ถุงขยะ", description: "ดูถุงขยะสำหรับเก็บขี้", value: "cleaning" },
                ])
        ]);

        // ปุ่มปิดหน้า inventory
        const closeRow = new ActionRowBuilder().addComponents([
            new ButtonBuilder()
                .setCustomId("inv_close")
                .setLabel("ปิด")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Danger)
        ]);

        // แสดงรายการอาหารสัตว์เลี้ยงและถุงขยะ
        const embed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.user.username}'s Inventory`, iconURL: interaction.user.displayAvatarURL() })
            .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/706473362813091931.gif")
            .setDescription(`พื้นที่กระเป๋า: (${totalBackpack})\nเลือกหมวดจากเมนูด้านล่างเพื่อแสดงรายการ`)
            .setColor(client.color);

        const msg = await interaction.editReply({ embeds: [embed], components: [selectRow, closeRow] });

        // อัปเดต cooldown
        inventoryCooldowns.set(interaction.user.id, Date.now());

        const filter = (i) => i.user.id === interaction.user.id && ["inv_select", "inv_close"].includes(i.customId);
        const collector = msg.createMessageComponentCollector({ filter, time: 300000 });
        const nonOwnerCollector = msg.createMessageComponentCollector({ filter: (x) => x.user.id !== interaction.user.id, time: 300000 });
        nonOwnerCollector.on('collect', async (menu) => { 
            try { 
                const notOwnerEmbed = new EmbedBuilder()
                    .setColor(client.color)
                    .setTitle("🚫 ไม่สามารถใช้งานได้")
                    .setDescription("เมนูนี้สำหรับผู้ที่เรียกคำสั่งเท่านั้น");
                await menu.reply({ embeds: [notOwnerEmbed], ephemeral: true }); 
            } catch {} 
        });

        collector.on("collect", async (menu) => {
            await menu.deferUpdate();

            if (menu.customId === "inv_close") {
                // ปิดคอมโพเนนต์ทั้งหมดและหยุดตัวเก็บ
                try {
                    await msg.edit({ components: [] });
                } catch {}
                collector.stop("closed");
                return;
            }

            const [selected] = menu.values || [];

            if (selected === "pet") {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `${interaction.user.username}'s Inventory • อาหารสัตว์เลี้ยง`, iconURL: interaction.user.displayAvatarURL() })
                    .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/food.png")
                    .setDescription(`พื้นที่กระเป๋า: (${totalBackpack})`)
                    .addFields(
                        { name: "🍖 อาหารสัตว์เลี้ยง", value: `${sFood.join("\n") || "ไม่มีอะไรเลย !"}`, inline: false },
                    )
                    .setColor(client.color);

                await msg.edit({ embeds: [embed], components: [selectRow, closeRow] });
            }

            if (selected === "cleaning") {
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `${interaction.user.username}'s Inventory • ถุงขยะ`, iconURL: interaction.user.displayAvatarURL() })
                    .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/garbage.png")
                    .setDescription(`พื้นที่กระเป๋า: (${totalBackpack})`)
                    .addFields(
                        { name: "🗑️ ถุงขยะ", value: `${sCleaning.join("\n") || "ไม่มีอะไรเลย !"}`, inline: false },
                    )
                    .setColor(client.color);

                await msg.edit({ embeds: [embed], components: [selectRow, closeRow] });
            }
        });

        collector.on("end", async () => {
            // ปิดการโต้ตอบหลังหมดเวลา โดยคง embed ล่าสุดไว้
            const message = await interaction.fetchReply();
            if (!message.editable) return;
            try {
                await msg.edit({ components: [] });
            } catch {}
            try { nonOwnerCollector.stop(); } catch {}
        });
    }
}

function toOppositeCase(char) {
    return char.charAt(0).toUpperCase() + char.slice(1);
}