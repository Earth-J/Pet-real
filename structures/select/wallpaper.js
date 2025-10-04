const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { editWallL, editWallR } = require("../edit/wallpaper.js")
const GInv = require("../../settings/models/inventory.js");
const Canvas = require("@napi-rs/canvas");
const { imageCache } = require("../utils/imageCache.js");

function getWallpaperEmoji(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('left')) return '⬅️';
    if (n.includes('right')) return '➡️';
    if (n.includes('nano') || n.includes('space')) return '🌌';
    if (n.includes('light')) return '💡';
    if (n.includes('mona') || n.includes('liza')) return '🖼️';
    return '🧱';
}

const selectWallSide = async function (client, interaction, msg, item , type) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    try {
        const button = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("wall_left_e")
                .setLabel("ซ้าย")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("wall_right_e")
                .setLabel("ขวา")
                .setStyle(ButtonStyle.Secondary),
            );

        const nav = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('back_edit').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('close_edit').setLabel('ปิด').setStyle(ButtonStyle.Danger)
        );

        const canvas = Canvas.createCanvas(450, 300);
        const ctx = canvas.getContext("2d");

        const shop = await imageCache.getImage("./assests/shop/two.png");
        if (shop) {
            ctx.drawImage(shop, 0, 0, canvas.width, canvas.height);
        } else {
            return interaction.editReply({ content: "❌ ไม่สามารถโหลดรูปภาพได้", embeds: [], components: [] });
        }

        const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `two.png` });

        const embed = new EmbedBuilder()
            .setImage("attachment://two.png")
            .setColor(client.color);

        await interaction.editReply({ content: "เลือกด้านของวอลเปเปอร์ที่จะวาง", embeds: [embed], components: [button, nav], files: [attc] });

        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (menu) => {
            if (menu.isButton()) {
                if(menu.customId === "wall_left_e") {
                    await menu.deferUpdate();
                    await selectWallpaper_left(client, interaction, msg, item);
                    collector.stop();
                } else if (menu.customId === "wall_right_e") {
                    await menu.deferUpdate();
                    await selectWallpaper_right(client, interaction, msg, item);
                    collector.stop();
                } else if (menu.customId === 'back_edit') {
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
                    .setDescription(`⏰ หมดเวลาแล้ว!`)
                    .setColor(client.color);

                await interaction.editReply({ embeds: [timed], components: [], files: [] });
            }
        });

    } catch (error) {
        console.error('Error in selectWallSide:', error);
        await interaction.editReply({ content: "❌ เกิดข้อผิดพลาด", embeds: [], components: [] });
    }

    return;
}

const selectWallpaper_left = async (client, interaction, msg) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    try {
        const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

        const value = Object.values(inv.item);
        const object = value.filter(x => x.type === "wallpaper" && x.side === "left");

        if(object.length === 0) {
            return interaction.editReply({ content: "คุณยังไม่มีวอลเปเปอร์ด้านซ้าย", embeds: [], files: [], components: [] });
        }

        const embed = new EmbedBuilder()
            .setColor(client.color)
            .setDescription("เลือกวอลเปเปอร์ด้านซ้าย");

        const select = new ActionRowBuilder()
            .addComponents([
                new StringSelectMenuBuilder()
                    .setCustomId("wallselect_left")
                    .setPlaceholder("เลือกวอลเปเปอร์")
                    .setMaxValues(1)
                    .setMinValues(1)
                    .setOptions(object.map(key => {
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(`${toOppositeCase(key.name)}`)
                            .setValue(key.id)
                            .setEmoji(getWallpaperEmoji(key.name))
                        }
                    ))
                ]);

        const nav = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('back_edit').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('close_edit').setLabel('ปิด').setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({ content: " ", embeds: [embed], components: [select, nav], files: [] });

        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (menu) => {
            if(menu.isStringSelectMenu()) {
                if(menu.customId === "wallselect_left") {
                    await menu.deferUpdate();
                    let [ directory ] = menu.values;

                    const item = inv.item.find(x => x.id === directory);

                    editWallL(client, interaction, msg, item.name, item.type, item.id);
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
                    .setDescription(`⏰ หมดเวลาแล้ว!`)
                    .setColor(client.color);

                interaction.editReply({ embeds: [timed], components: [] });
            }
        });

    } catch (error) {
        console.error('Error in selectWallpaper_left:', error);
        await interaction.editReply({ content: "❌ เกิดข้อผิดพลาด", embeds: [], components: [] });
    }

   return;
}

const selectWallpaper_right = async (client, interaction, msg) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    try {
        const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

        const value = Object.values(inv.item);
        const object = value.filter(x => x.type === "wallpaper" && x.side === "right");

        if(object.length === 0) {
            return interaction.editReply({ content: "คุณยังไม่มีวอลเปเปอร์ด้านขวา", embeds: [], files: [], components: [] });
        }

        const embed = new EmbedBuilder()
            .setColor(client.color)
            .setDescription("เลือกวอลเปเปอร์ด้านขวา");

        const select = new ActionRowBuilder()
            .addComponents([
                new StringSelectMenuBuilder()
                    .setCustomId("wallselect_right")
                    .setPlaceholder("เลือกวอลเปเปอร์")
                    .setMaxValues(1)
                    .setMinValues(1)
                    .setOptions(object.map(key => {
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(`${toOppositeCase(key.name)}`)
                            .setValue(key.id)
                            .setEmoji(getWallpaperEmoji(key.name))
                        }
                    ))
                ]);

        const nav = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('back_edit').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('close_edit').setLabel('ปิด').setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({ content: " ", embeds: [embed], components: [select, nav], files: [] });

        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (menu) => {
            if(menu.isStringSelectMenu()) {
                if(menu.customId === "wallselect_right") {
                    await menu.deferUpdate();
                    let [ directory ] = menu.values;

                    const item = inv.item.find(x => x.id === directory);

                    editWallR(client, interaction, msg, item.name, item.type, item.id);
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
                    .setDescription(`⏰ หมดเวลาแล้ว!`)
                    .setColor(client.color);

                interaction.editReply({ embeds: [timed], components: [] });
            }
        });

    } catch (error) {
        console.error('Error in selectWallpaper_right:', error);
        await interaction.editReply({ content: "❌ เกิดข้อผิดพลาด", embeds: [], components: [] });
    }

   return;
}

function toOppositeCase(char) {
    return char.charAt(0).toUpperCase() + char.slice(1);
}

module.exports = { selectWallpaper_left, selectWallSide, selectWallpaper_right };