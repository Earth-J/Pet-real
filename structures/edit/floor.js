const { EmbedBuilder, ActionRowBuilder, SelectMenuBuilder, AttachmentBuilder, ButtonStyle, ButtonBuilder } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const GInv = require("../../settings/models/inventory.js");
const GHouse = require("../../settings/models/house.js");
const { replaceHouse } = require("../../structures/replace.js");
const { saveFLOOR } = require("./confirm.js");
const { getRenderQueue } = require("../services/renderQueueSingleton");
const { isLocalServiceUrl, uploadFromUrlToDiscordMessage, fetchBuffer } = require("../services/discordUpload");
const { buildHouseLayers } = require("../services/layout");

const editFloor = async (client, interaction, msg, item, type, id) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    const canvas = Canvas.createCanvas(300, 300);
    const ctx = canvas.getContext("2d");

    const place_on = await Canvas.loadImage("./assests/default.png");
    ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height); // and place

    const check = inv.item.find(x => x.id === id);
    // already place
    if (home.FLOOR_DATA.FLOORI === check.name) {
        await msg.edit({ content: "You already placed this floor.", embeds: [], components: [] });
        return;
    }

    // place floor
    home.FLOOR_DATA.FLOOR = true;
    home.FLOOR_DATA.FLOORI = check.name;
    await home.save();
    // rebuild
    await replaceHouse(client, interaction, ctx, home)

    // เรียก render-service เพื่อทำ Preview อัตโนมัติ
    const queue = getRenderQueue();

    try {
        await msg.edit({ content: `🧩 อัปเดตพื้นสำเร็จ กำลังเรนเดอร์ Preview...`, embeds: [], components: [] });
        const payload = {
            guild: interaction.guild.id,
            user: interaction.user.id,
            size: { width: 300, height: 300 },
            format: 'png',
            layers: buildHouseLayers(home),
        };
        const { jobId } = await queue.enqueue(payload);
        const result = await queue.waitForResult(jobId);

        // แสดงปุ่ม Save/Cancel พร้อม Preview ผ่าน Embed + แนบไฟล์
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('preview_save_floor').setLabel('Save').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('preview_cancel_floor').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );
        const buf = await fetchBuffer(result.url);
        const att = new AttachmentBuilder(buf, { name: 'preview.png' });
        const embedPrev = new EmbedBuilder().setTitle('House Preview').setImage('attachment://preview.png').setColor(client.color);
        await msg.edit({ content: " ", embeds: [embedPrev], components: [row], files: [att] });

        const filter = (m) => m.user.id === interaction.user.id;
        const collector = await msg.createMessageComponentCollector({ filter, time: 300000 });
        collector.on('collect', async (i) => {
            await i.deferUpdate();
            if (i.customId === 'preview_save_floor') {
                let finalUrl = result.url;
                if (isLocalServiceUrl(finalUrl, process.env.RENDER_SERVICE_URL)) {
                    const uploaded = await uploadFromUrlToDiscordMessage(msg, finalUrl, `house.${result.format === 'gif' ? 'gif' : 'png'}`);
                    if (uploaded) finalUrl = uploaded;
                }
                await saveFLOOR(interaction, id, msg, /*message=*/null, check, finalUrl);
                collector.stop();
            } else if (i.customId === 'preview_cancel_floor') {
                // rollback ค่า floor ที่เพิ่งแก้
                home.FLOOR_DATA.FLOOR = false;
                home.FLOOR_DATA.FLOORI = "";
                await home.save();
                const cancelEmbed = new EmbedBuilder().setColor(client.color).setDescription('ยกเลิกแล้ว');
                await msg.edit({ embeds: [cancelEmbed], components: [], files: [] });
                collector.stop();
            }
        });
        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                // rollback อัตโนมัติเมื่อหมดเวลา
                home.FLOOR_DATA.FLOOR = false;
                home.FLOOR_DATA.FLOORI = "";
                await home.save();
                const timeoutEmbed = new EmbedBuilder().setColor(client.color).setDescription('หมดเวลา ยกเลิกการแก้ไข');
                await msg.edit({ embeds: [timeoutEmbed], components: [], files: [] });
            }
        });
    } catch (e) {
        // ถ้า service ล้มเหลว ให้ fallback แสดง PNG เดิม + ปุ่ม Save/Exit เดิม
        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
        await msg.edit({ embeds: [], components: [], files: [build] }).then(async (message) => {
            await saveFLOOR(interaction, id, msg, message, check);
        });
    }

    return;
}

module.exports = { editFloor };