const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, SelectMenuOptionBuilder, ButtonBuilder, ButtonStyle} = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const GProfile = require("../../settings/models/profile.js");
const GInv = require("../../settings/models/inventory.js");
const { wallpaper } = require("../../settings/default.js");

const selectSide = async (client, interaction, msg, item) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');
    
        const button = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("wall_left")
                .setLabel("ซ้าย")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("wall_right")
                .setLabel("ขวา")
                .setStyle(ButtonStyle.Secondary),
            )

        const canvas = Canvas.createCanvas(450, 300);
        const ctx = canvas.getContext("2d");

        const shop = await Canvas.loadImage("./assests/shop/two.png");
        ctx.drawImage(shop, 0, 0, canvas.width, canvas.height);

        const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `two.png` })

        const embed = new EmbedBuilder()
            .setImage("attachment://two.png")
            .setColor(client.color)

        await msg.edit({ content: "เลือกด้านของวอลเปเปอร์ที่จะซื้อ", embeds: [embed], components: [button], files: [attc] });

        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (menu) => {
            if (menu.isButton()) {
                await menu.deferUpdate();

                if(menu.customId === "wall_left") {

                await shopWallpaper_left(client, interaction, msg, item)
                collector.stop();
                } else if (menu.customId === "wall_right") {

                await shopWallpaper_right(client, interaction, msg, item)
                collector.stop();
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if(reason === 'time') {
                const timed = new EmbedBuilder()
                    .setDescription(`หมดเวลาแล้ว`)
                    .setColor(client.color)

                msg.edit({ embeds: [timed], components: [], files: [] });
            }
        });

    return;
}

const shopWallpaper_left = async (client, interaction, msg, item) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

        //this returns the values
        const object = Object.values(wallpaper).filter(x => x.side === "left");

        const itemsPerPage = 6;
        const totalPages = Math.max(1, Math.ceil(object.length / itemsPerPage));
        let page = 0;

        const buildSelectRow = () => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageItems = object.slice(start, end);
            return new ActionRowBuilder().addComponents([
                new StringSelectMenuBuilder()
                    .setCustomId("shop_wallpaper_left")
                    .setPlaceholder(`เลือกสินค้าที่ต้องการซื้อ • หน้า ${page + 1}/${totalPages}`)
                    .setMaxValues(1)
                    .setMinValues(1)
                    .setOptions(pageItems.map(key => {
                        return new SelectMenuOptionBuilder()
                            .setLabel(`${toOppositeCase(key.name.replace("_", " "))} | ราคา: ${Commas(key.price)} (เลเวล ${key.level})`)
                            .setValue(key.name)
                            .setEmoji(key.emoji)
                        }
                    ))
            ]);
        };

        const buildNavRow = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_wallpaper_left_first').setLabel('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_wallpaper_left_prev').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_wallpaper_left_close').setLabel('ปิด').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('shop_wallpaper_left_next').setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_wallpaper_left_last').setLabel('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1 || totalPages <= 1)
        );

        const profile = await GProfile.findOne({ guild: interaction.guild.id, user: interaction.user.id });
        const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

        const canvas = Canvas.createCanvas(450, 300);
        const ctx = canvas.getContext("2d");

        const shop = await Canvas.loadImage("./assests/shop/two.png");
        ctx.drawImage(shop, 0, 0, canvas.width, canvas.height);

        const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `two.png` })

        const embed = new EmbedBuilder()
            .setImage("attachment://two.png")
            .setColor(client.color)

        await msg.edit({ content: " ", embeds: [embed], components: totalPages <= 1 ? [buildSelectRow()] : [buildSelectRow(), buildNavRow()], files: [attc] });

        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (menu) => {
            if(menu.isSelectMenu && menu.isSelectMenu()) {
                if(menu.customId === "shop_wallpaper_left") {
                    await menu.deferUpdate();
                    let [ directory ] = menu.values;

                    const item = wallpaper.find(x => x.name === directory);

                    if (profile.money < item.price) return menu.followUp({ content: "เงินไม่พอ ราคา: " + item.price });
                    if (profile.level < item.level) return menu.followUp({ content: "ต้องการเลเวล: " + item.level });
                    if (inv.item.length > profile.inventory) return menu.followUp({ content: "กระเป๋าเต็มสูงสุด: " + profile.inventory });

                    profile.money -= item.price;

                    inv.item.push({
                        name: item.name,
                        type: item.type,
                        side: item.side,
                        price: item.price,
                        level: item.level,
                        emoji: item.emoji || null,
                        id: generateID()
                    });

                    const bought = new EmbedBuilder()
                        .setDescription("ซื้อสำเร็จ: " + item.name)
                        .setColor(client.color)

                    await profile.save();
                    await inv.save();
                    await menu.followUp({ embeds: [bought] });
                }
            } else if (menu.isButton && menu.isButton()) {
                if (totalPages <= 1) {
                    await menu.deferUpdate();
                    return;
                }
                if (menu.customId === 'shop_wallpaper_left_first') {
                    await menu.deferUpdate();
                    page = 0;
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_wallpaper_left_prev') {
                    await menu.deferUpdate();
                    page = Math.max(0, page - 1);
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_wallpaper_left_next') {
                    await menu.deferUpdate();
                    page = Math.min(totalPages - 1, page + 1);
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_wallpaper_left_last') {
                    await menu.deferUpdate();
                    page = Math.max(0, totalPages - 1);
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_wallpaper_left_close') {
                    await menu.deferUpdate();
                    await msg.edit({ components: [], files: [], content: 'ปิดร้านแล้ว' });
                    collector.stop();
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if(reason === 'time') {
                const timed = new EmbedBuilder()
                    .setDescription(`หมดเวลาแล้ว`)
                    .setColor(client.color)

                msg.edit({ embeds: [timed], components: [], files: [] });
            }
        });
   return;
}

const shopWallpaper_right = async (client, interaction, msg, item) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

        //this returns the values
        const object = Object.values(wallpaper).filter(x => x.side === "right");

        const itemsPerPage = 6;
        const totalPages = Math.max(1, Math.ceil(object.length / itemsPerPage));
        let page = 0;

        const buildSelectRow = () => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageItems = object.slice(start, end);
            return new ActionRowBuilder().addComponents([
                new StringSelectMenuBuilder()
                    .setCustomId("shop_wallpaper_right")
                    .setPlaceholder(`เลือกสินค้าที่ต้องการซื้อ • หน้า ${page + 1}/${totalPages}`)
                    .setMaxValues(1)
                    .setMinValues(1)
                    .setOptions(pageItems.map(key => {
                        return new SelectMenuOptionBuilder()
                            .setLabel(`${toOppositeCase(key.name.replace("_", " "))} | ราคา: ${Commas(key.price)} (เลเวล ${key.level})`)
                            .setValue(key.name)
                            .setEmoji(key.emoji)
                        }
                    ))
            ]);
        };

        const buildNavRow = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_wallpaper_right_first').setLabel('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_wallpaper_right_prev').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_wallpaper_right_close').setLabel('ปิด').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('shop_wallpaper_right_next').setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_wallpaper_right_last').setLabel('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1 || totalPages <= 1)
        );

        const profile = await GProfile.findOne({ guild: interaction.guild.id, user: interaction.user.id });
        const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

        const canvas = Canvas.createCanvas(450, 300);
        const ctx = canvas.getContext("2d");

        const shop = await Canvas.loadImage("./assests/shop/two.png");
        ctx.drawImage(shop, 0, 0, canvas.width, canvas.height);

        const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `two.png` })

        const embed = new EmbedBuilder()
            .setImage("attachment://two.png")
            .setColor(client.color)

        await msg.edit({ content: " ", embeds: [embed], components: totalPages <= 1 ? [buildSelectRow()] : [buildSelectRow(), buildNavRow()], files: [attc] });

        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (menu) => {
            if(menu.isSelectMenu && menu.isSelectMenu()) {
                if(menu.customId === "shop_wallpaper_right") {
                    await menu.deferUpdate();
                    let [ directory ] = menu.values;

                    const item = wallpaper.find(x => x.name === directory);

                    if (profile.money < item.price) return menu.followUp({ content: "เงินไม่พอ ราคา: " + item.price });
                    if (profile.level < item.level) return menu.followUp({ content: "ต้องการเลเวล: " + item.level });
                    if (inv.item.length > profile.inventory) return menu.followUp({ content: "กระเป๋าเต็มสูงสุด: " + profile.inventory });

                    profile.money -= item.price;

                    inv.item.push({
                        name: item.name,
                        type: item.type,
                        side: item.side,
                        price: item.price,
                        level: item.level,
                        emoji: item.emoji || null,
                        id: generateID()
                    });

                    const bought = new EmbedBuilder()
                        .setDescription("ซื้อสำเร็จ: " + item.name)
                        .setColor(client.color)

                    await profile.save();
                    await inv.save();
                    await menu.followUp({ embeds: [bought] });
                }
            } else if (menu.isButton && menu.isButton()) {
                if (totalPages <= 1) {
                    await menu.deferUpdate();
                    return;
                }
                if (menu.customId === 'shop_wallpaper_right_first') {
                    await menu.deferUpdate();
                    page = 0;
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_wallpaper_right_prev') {
                    await menu.deferUpdate();
                    page = Math.max(0, page - 1);
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_wallpaper_right_next') {
                    await menu.deferUpdate();
                    page = Math.min(totalPages - 1, page + 1);
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_wallpaper_right_last') {
                    await menu.deferUpdate();
                    page = Math.max(0, totalPages - 1);
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_wallpaper_right_close') {
                    await menu.deferUpdate();
                    await msg.edit({ components: [], files: [], content: 'ปิดร้านแล้ว' });
                    collector.stop();
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if(reason === 'time') {
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

module.exports = { shopWallpaper_left, selectSide, shopWallpaper_right };