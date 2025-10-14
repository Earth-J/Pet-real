const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, SelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const GProfile = require("../../settings/models/profile.js");
const GInv = require("../../settings/models/inventory.js");
const { food } = require("../../settings/default.js");

const shopFood = async (client, interaction, msg, item) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

        //this returns the values
        const object = Object.values(food);

        const itemsPerPage = 6;
        const totalPages = Math.max(1, Math.ceil(object.length / itemsPerPage));
        let page = 0;

        const buildSelectRow = () => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const pageItems = object.slice(start, end);
            return new ActionRowBuilder().addComponents([
                new StringSelectMenuBuilder()
                    .setCustomId("shop_food")
                    .setPlaceholder(`เลือกสินค้าที่ต้องการซื้อ • หน้า ${page + 1}/${totalPages}`)
                    .setMaxValues(1)
                    .setMinValues(1)
                    .setOptions(pageItems.map(key => {
                        return new SelectMenuOptionBuilder()
                            .setLabel(`${toOppositeCase(key.name)} | ราคา: ${Commas(key.price)} (เลเวล ${key.level})`)
                            .setValue(key.name)
                            .setEmoji(key.emoji)
                        }
                    ))
            ]);
        };

        const buildNavRow = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shop_food_first').setLabel('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_food_prev').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_food_close').setLabel('ปิด').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('shop_food_next').setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1 || totalPages <= 1),
            new ButtonBuilder().setCustomId('shop_food_last').setLabel('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1 || totalPages <= 1)
        );

        const profile = await GProfile.findOne({ guild: interaction.guild.id, user: interaction.user.id });
        const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

        const canvas = Canvas.createCanvas(450, 300);
        const ctx = canvas.getContext("2d");

        const shop = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/shop/four.png");
        ctx.drawImage(shop, 0, 0, canvas.width, canvas.height);

        const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `four.png` })

        const embed = new EmbedBuilder()
            .setImage("attachment://four.png")
            .setColor(client.color)

        await msg.edit({ content: " ", embeds: [embed], components: totalPages <= 1 ? [buildSelectRow()] : [buildSelectRow(), buildNavRow()], files: [attc] });

        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (menu) => {
            if(menu.isSelectMenu && menu.isSelectMenu()) {
                if(menu.customId === "shop_food") {
                    await menu.deferUpdate();
                    let [ directory ] = menu.values;

                    const item = food.find(x => x.name === directory);

                    if (profile.money < item.price) return menu.followUp({ content: "เงินไม่พอ ราคา: " + item.price });
                    if (profile.level < item.level) return menu.followUp({ content: "ต้องการเลเวล: " + item.level });
                    if (inv.item.length > profile.inventory) return menu.followUp({ content: "กระเป๋าเต็มสูงสุด: " + profile.inventory });

                    profile.money -= item.price;

                    inv.item.push({
                        name: item.name,
                        type: item.type,
                        price: item.price,
                        level: item.level,
                        feed: item.feed,
                        exp: item.exp,
                        emoji: item.emoji || null,
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
                if (totalPages <= 1) {
                    await menu.deferUpdate();
                    return;
                }
                if (menu.customId === 'shop_food_first') {
                    await menu.deferUpdate();
                    page = 0;
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_food_prev') {
                    await menu.deferUpdate();
                    page = Math.max(0, page - 1);
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_food_next') {
                    await menu.deferUpdate();
                    page = Math.min(totalPages - 1, page + 1);
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_food_last') {
                    await menu.deferUpdate();
                    page = Math.max(0, totalPages - 1);
                    await msg.edit({ components: [buildSelectRow(), buildNavRow()] });
                } else if (menu.customId === 'shop_food_close') {
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

module.exports = { shopFood };