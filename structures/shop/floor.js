const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const GProfile = require("../../settings/models/profile.js");
const GInv = require("../../settings/models/inventory.js");
const floorList = require("../../settings/floor_price.json");

const shopFloor = async (client, interaction, msg, item) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

        // Use floor list from JSON
        const object = Array.isArray(floorList) ? floorList : [];

        const itemsPerPage = 6;
        const totalPages = Math.max(1, Math.ceil(object.length / itemsPerPage));
        let page = 0;

        const buildSelectRow = () => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageItems = object.slice(start, end);
            return new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("shop_floor")
                    .setPlaceholder(`เลือกสินค้าที่ต้องการซื้อ • หน้า ${page + 1}/${totalPages}`)
                    .setMaxValues(1)
                    .setMinValues(1)
                    .addOptions(pageItems.map(key => {
                        return new StringSelectMenuOptionBuilder()
                            .setLabel(`${toOppositeCase(key.name)} | ราคา: ${Commas(key.price)}`)
                            .setValue(key.name)
                    }))
            );
        };

        const buildNavRow = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_floor_first').setLabel('⏮').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_floor_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_floor_label').setLabel(`${page + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('shop_floor_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_floor_last').setLabel('⏭').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1 || totalPages <= 1)
        );

        const buildActionRow = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_floor_back').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('shop_floor_cancel').setLabel('ยกเลิก').setStyle(ButtonStyle.Danger)
        );

        const profile = await GProfile.findOne({ guild: interaction.guild.id, user: interaction.user.id });
        const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

        const buildPageImageUrl = () => {
            const pageNum = String(page + 1).padStart(3, '0');
            return `https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/shop/floor/page-${pageNum}.png`;
        };
        const buildRenderedEmbed = async () => {
            const width = 494;
            const height = 370;
            const canvas = Canvas.createCanvas(width, height);
            const ctx = canvas.getContext('2d');
            try {
                const img = await Canvas.loadImage(buildPageImageUrl());
                ctx.drawImage(img, 0, 0, width, height);
            } catch (_) {
                ctx.fillStyle = '#2b2d31';
                ctx.fillRect(0, 0, width, height);
            }
            const buffer = await canvas.encode('png');
            const attachment = new AttachmentBuilder(buffer, { name: 'shop.png' });
            const embed = new EmbedBuilder().setImage('attachment://shop.png').setColor(client.color);
            return { embed, attachment };
        };

        const renderAndEdit = async () => {
            const { embed, attachment } = await buildRenderedEmbed();
            await msg.edit({ content: " ", embeds: [embed], components: totalPages <= 1 ? [buildSelectRow(), buildActionRow()] : [buildSelectRow(), buildNavRow(), buildActionRow()], files: [attachment] });
        };

        await renderAndEdit();

        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, idle: 300000 });

        collector.on('collect', async (menu) => {
            if(menu.isSelectMenu && menu.isSelectMenu()) {
                if(menu.customId === "shop_floor") {
                    await menu.deferUpdate();
                    let [ directory ] = menu.values;

                    const item = object.find(x => x.name === directory);

                    if (profile.money < item.price) return menu.followUp({ content: "เงินไม่พอ ราคา: " + item.price });
                    if (inv.item.length > profile.inventory) return menu.followUp({ content: "กระเป๋าเต็มสูงสุด: " + profile.inventory });

                    profile.money -= item.price;

                    inv.item.push({
                        name: item.name,
                        type: 'floor',
                        price: item.price,
                        id: generateID()
                    });

                    const bought = new EmbedBuilder()
                        .setColor('#80DB79')
                        .setTitle('ซื้อสำเร็จ :')
                        .setDescription(`\` - \` 1x ${item.name}`)

                    await profile.save();
                    await inv.save();
                    await menu.followUp({ embeds: [bought] });
                }
            } else if (menu.isButton && menu.isButton()) {
                if (menu.customId === 'shop_floor_first') {
                    await menu.deferUpdate();
                    page = Math.max(0, page - 5);
                    await renderAndEdit();
                } else if (menu.customId === 'shop_floor_prev') {
                    await menu.deferUpdate();
                    page = Math.max(0, page - 1);
                    await renderAndEdit();
                } else if (menu.customId === 'shop_floor_prev5') {
                    await menu.deferUpdate();
                    page = Math.max(0, page - 5);
                    await renderAndEdit();
                } else if (menu.customId === 'shop_floor_next') {
                    await menu.deferUpdate();
                    page = Math.min(totalPages - 1, page + 1);
                    await renderAndEdit();
                } else if (menu.customId === 'shop_floor_next5') {
                    await menu.deferUpdate();
                    page = Math.min(totalPages - 1, page + 5);
                    await renderAndEdit();
                } else if (menu.customId === 'shop_floor_last') {
                    await menu.deferUpdate();
                    page = Math.min(totalPages - 1, page + 5);
                    await renderAndEdit();
                } else if (menu.customId === 'shop_floor_back') {
                    await menu.deferUpdate();
                    collector.stop();
                    const { openShopMenu } = require('../../commands/General/Shop.js');
                    return await openShopMenu(client, interaction, msg);
                } else if (menu.customId === 'shop_floor_cancel') {
                    await menu.deferUpdate();
                    await msg.edit({ components: [], files: [], content: 'ยกเลิกการซื้อแล้ว'  ,embeds: []});
                    collector.stop();
                } else if (menu.customId === 'shop_floor_close') {
                    await menu.deferUpdate();
                    await msg.edit({ components: [], files: [], content: 'ปิดร้านแล้ว' ,embeds: [] });
                    collector.stop();
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if(reason === 'idle') {
                const timed = new EmbedBuilder()
                    .setDescription(`หมดเวลาแล้ว`)
                    .setColor(client.color)

                msg.edit({ embeds: [timed], components: [], files: [] });
            }
        });
    return;
}

function Commas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function toOppositeCase(char) {
    return char.charAt(0).toUpperCase() + char.slice(1);
}

const crypto = require('crypto');
function generateID() {
    return crypto.randomBytes(16).toString('base64');
};

module.exports = { shopFloor };