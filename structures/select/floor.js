const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { editFloor } = require("../edit/floor.js")
const GInv = require("../../settings/models/inventory.js");

function getFloorEmoji(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('wood')) return '🪵';
    if (n.includes('iron')) return '⚙️';
    if (n.includes('gold')) return '🥇';
    if (n.includes('diamond')) return '💎';
    if (n.includes('emerald')) return '🟩';
    return '🧱';
}

const selectFloor = async (client, interaction, msg) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    const value = Object.values(inv.item);
    const object = value.filter(x => x.type === "floor");

    if(object.length === 0) {
        return interaction.editReply({ content: "คุณยังไม่มีพื้นห้อง", embeds: [], files: [], components: [] });
    }

    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription("เลือกพื้นห้องที่ต้องการวาง")

    const select = new ActionRowBuilder()
        .addComponents([
            new StringSelectMenuBuilder()
                .setCustomId("floorselect")
                .setPlaceholder("เลือกพื้นห้อง")
                .setMaxValues(1)
                .setMinValues(1)
                .setOptions(object.map(key => {
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(`${toOppositeCase(key.name)}`)
                        .setValue(key.id)
                        .setEmoji(getFloorEmoji(key.name))
                    }
                ))
            ])

    const nav = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_edit').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('close_edit').setLabel('ปิด').setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [select, nav], files: [] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    collector.on('collect', async (menu) => {
        if(menu.isStringSelectMenu()) {
            if(menu.customId === "floorselect") {
                await menu.deferUpdate();
                let [ directory ] = menu.values;

                const item = inv.item.find(x => x.id === directory);

                editFloor(client, interaction, msg, item.name, item.type, item.id);
                await collector.stop();
            }
        } else if (menu.isButton()) {
            if (menu.customId === 'back_edit') {
                await menu.deferUpdate();
                collector.stop();
                const HouseEdit = require("../../commands/House/HouseEdit.js");
                if (typeof HouseEdit.returnToRoot === 'function') {
                    await HouseEdit.returnToRoot(client, interaction, msg);
                } else {
                    await interaction.editReply({ content: 'ไม่สามารถย้อนกลับได้ กรุณาใช้ /house edit ใหม่', embeds: [], components: [] });
                }
            } else if (menu.customId === 'close_edit') {
                await menu.deferUpdate();
                await interaction.editReply({ content: 'ปิดการแก้ไขแล้ว', embeds: [], components: [], files: [] });
                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            const timed = new EmbedBuilder()
                .setDescription(`หมดเวลาแล้ว`)
                .setColor(client.color)

            interaction.editReply({ embeds: [timed], components: [] });
        }
    });

   return;
}

function toOppositeCase(char) {
    return char.charAt(0).toUpperCase() + char.slice(1);
}

module.exports = { selectFloor };