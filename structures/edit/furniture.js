const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, ButtonStyle, ButtonBuilder } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const GInv = require("../../settings/models/inventory.js");
const GHouse = require("../../settings/models/house.js");
const { replaceHouse } = require("../../structures/replace.js");
const { saveA1, saveA2, saveA3, saveA4, saveB1, saveB2, saveB3, saveB4, saveC1, saveC2, saveC3, saveC4, saveD1, saveD2, saveD3, saveD4 } = require("../../structures/edit/confirm.js");
const { RenderQueueClient } = require("../services/renderQueue");
const { isLocalServiceUrl, uploadFromUrlToInteraction } = require("../services/discordUpload");
const { buildHouseLayers } = require("../services/layout");
const fs = require('fs');
const path = require('path');

// ฟังก์ชันตรวจสอบว่าไฟล์เฟอร์นิเจอร์มีอยู่หรือไม่
function furnitureImageExists(itemName) {
    const imagePath = path.join('./assests/furniture/', `${itemName}.png`);
    return fs.existsSync(imagePath);
}

// ฟังก์ชันโหลดรูปภาพอย่างปลอดภัย
async function loadImageSafely(imagePath) {
    try {
        const fullPath = path.resolve(imagePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${fullPath}`);
        }
        // ใช้ file:// protocol สำหรับ Windows
        const fileUrl = process.platform === 'win32' 
            ? `file:///${fullPath.replace(/\\/g, '/')}`
            : `file://${fullPath}`;
        return await Canvas.loadImage(fileUrl);
    } catch (error) {
        console.error(`Error loading image ${imagePath}:`, error);
        // fallback: ลองใช้ buffer แทน
        try {
            const imageBuffer = fs.readFileSync(path.resolve(imagePath));
            return await Canvas.loadImage(imageBuffer);
        } catch (bufferError) {
            console.error(`Buffer fallback failed:`, bufferError);
            throw error;
        }
    }
}

async function previewAndConfirmFurniture({ client, interaction, msg, home, inv, check, positionLabel, rollback }) {
    const queue = new RenderQueueClient({
        baseUrl: process.env.RENDER_SERVICE_URL || "http://localhost:8081",
        apiKey: process.env.RENDER_SERVICE_KEY || undefined,
        pollIntervalMs: 1500,
        timeoutMs: 45000,
    });
    try {
        await interaction.editReply({ content: `🧩 วางเฟอร์นิเจอร์ที่ ${positionLabel} แล้ว กำลังเรนเดอร์ Preview...`, embeds: [], components: [] });
        const payload = {
            guild: interaction.guild.id,
            user: interaction.user.id,
            size: { width: 300, height: 300 },
            format: 'png',
            layers: buildHouseLayers(home),
        };
        const { jobId } = await queue.enqueue(payload);
        const result = await queue.waitForResult(jobId);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('preview_save_fur').setLabel('Save').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('preview_cancel_fur').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );
        const { fetchBuffer } = require('../services/discordUpload');
        const buf = await fetchBuffer(result.url);
        const att = new AttachmentBuilder(buf, { name: 'preview.png' });
        const embedPrev = new EmbedBuilder().setTitle('House Preview').setImage('attachment://preview.png').setColor(client.color);
        await interaction.editReply({ content: " ", embeds: [embedPrev], components: [row], files: [att] });

        const filter = (m) => m.user.id === interaction.user.id;
        const collector = await msg.createMessageComponentCollector({ filter, time: 300000 });
        collector.on('collect', async (i) => {
            await i.deferUpdate();
            if (i.customId === 'preview_save_fur') {
                // commit: remove item from inv, save URL
                inv.item.splice(inv.item.findIndex(x => x.id === check.id), 1);
                await inv.save();
                let finalUrl = result.url;
                if (isLocalServiceUrl(finalUrl, process.env.RENDER_SERVICE_URL)) {
                    const uploaded = await uploadFromUrlToInteraction(interaction, finalUrl, `house.${result.format === 'gif' ? 'gif' : 'png'}`);
                    if (uploaded) finalUrl = uploaded;
                }
                home.house = finalUrl;
                await home.save();
                const savedEmbed = new EmbedBuilder().setColor(client.color).setDescription('House has saved.');
                await interaction.editReply({ embeds: [savedEmbed], components: [], files: [] });
                collector.stop();
            } else if (i.customId === 'preview_cancel_fur') {
                // rollback state
                if (rollback) await rollback();
                const cancelEmbed = new EmbedBuilder().setColor(client.color).setDescription('ยกเลิกแล้ว');
                await interaction.editReply({ embeds: [cancelEmbed], components: [], files: [] });
                collector.stop();
            }
        });
        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                if (rollback) await rollback();
                const timeoutEmbed = new EmbedBuilder().setColor(client.color).setDescription('หมดเวลา ยกเลิกการแก้ไข');
                await interaction.editReply({ embeds: [timeoutEmbed], components: [], files: [] });
            }
        });
        return true;
    } catch (e) {
        console.error('Error in previewAndConfirmFurniture:', e);
        if (rollback) await rollback();
        return false; // ให้ fallback PNG เดิม
    }
}

const editFurnitureA = async function (client, interaction, msg, item, type, id) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const canvas = Canvas.createCanvas(300, 300);
    const ctx = canvas.getContext("2d");

    try {
        const placer = await loadImageSafely("./assests/aone.png");
        ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
    } catch (error) {
        console.error(`Error loading aone.png:`, error);
        return interaction.editReply({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", embeds: [], components: [] });
    }

    const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `aone.png` })

    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setImage("attachment://aone.png")
        .setDescription("*Please Select a Postion*")

    const select = new ActionRowBuilder()
        .addComponents([
            new StringSelectMenuBuilder()
                .setCustomId("furplace_a")
                .setPlaceholder("Placing a furniture.")
                .setMaxValues(1)
                .setMinValues(1)
                .setOptions([
                    {
                        label: "Ⓐ➀",
                        description: "Place on position A1",
                        value: "place_aone"
                    },
                    {
                        label: "Ⓐ➁",
                        description: "Place on position A2",
                        value: "place_atwo"
                    },
                    {
                        label: "Ⓐ➂",
                        description: "Place on position A3",
                        value: "place_athree"
                    },
                    {
                        label: "Ⓐ➃",
                        description: "Place on position A4",
                        value: "place_afour"
                    }
                ])
            ])

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("a_one")
            .setLabel("A1")
            .setDisabled(true)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("b_two")
            .setLabel("A2")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("c_three")
            .setLabel("A3")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("d_four")
            .setLabel("A4")
            .setStyle(ButtonStyle.Secondary),
        )

    await interaction.editReply({ embeds: [embed], components: [select, button], files: [attc] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isStringSelectMenu()) {
            // id select menus
            if(menu.customId === "furplace_a") {
                await menu.deferUpdate();
                /// value id
                let [ directory ] = menu.values;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                try {
                    const place_on = await loadImageSafely("./assests/default.png");
                    ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height); // and place
                } catch (error) {
                    console.error('Error loading default.png:', error);
                    return menu.followUp({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", ephemeral: true });
                }
                
                if (directory === "place_aone") {
                    /// checking position
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.A_DATA.A1 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.A_DATA.A2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.A_DATA.A1 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // save and replace
                    if(check.area === 2) {
                        home.A_DATA.A1 = true; home.A_DATA.A1I = check.name;
                        home.A_DATA.A2 = true; home.A_DATA.A2I = check.name;
                    } else {
                        home.A_DATA.A1 = true; home.A_DATA.A1I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'A1',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.A_DATA.A1 = false; home.A_DATA.A1I = "";
                                home.A_DATA.A2 = false; home.A_DATA.A2I = "";
                            } else {
                                home.A_DATA.A1 = false; home.A_DATA.A1I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveA1(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_atwo") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.A_DATA.A2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.A_DATA.A3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.A_DATA.A2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    // save and replace
                    if(check.area === 2) {
                        home.A_DATA.A2 = true; home.A_DATA.A2I = check.name;
                        home.A_DATA.A3 = true; home.A_DATA.A3I = check.name;
                    } else {
                        home.A_DATA.A2 = true; home.A_DATA.A2I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'A2',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.A_DATA.A2 = false; home.A_DATA.A2I = "";
                                home.A_DATA.A3 = false; home.A_DATA.A3I = "";
                            } else {
                                home.A_DATA.A2 = false; home.A_DATA.A2I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveA2(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_athree") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.A_DATA.A3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.A_DATA.A4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.A_DATA.A3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    
                    // save and replace
                    if(check.area === 2) {
                        home.A_DATA.A3 = true; home.A_DATA.A3I = check.name;
                        home.A_DATA.A4 = true; home.A_DATA.A4I = check.name;
                    } else {
                        home.A_DATA.A3 = true; home.A_DATA.A3I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'A3',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.A_DATA.A3 = false; home.A_DATA.A3I = "";
                                home.A_DATA.A4 = false; home.A_DATA.A4I = "";
                            } else {
                                home.A_DATA.A3 = false; home.A_DATA.A3I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveA3(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_afour") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.A_DATA.A4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.A_DATA.A4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    if(check.area === 2) return menu.followUp({ content: `You can't place ${check.name} on this position`, ephemeral: true })

                    // save and replace
                    home.A_DATA.A4 = true;
                    home.A_DATA.A4I = check.name;
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)
                    
                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'A4',
                        rollback: async () => {
                            home.A_DATA.A4 = false;
                            home.A_DATA.A4I = "";
                            await home.save();
                        }
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveA4(interaction, id, msg, message, check);
                    }
                    collector.stop();
                }
            }
        } else if(menu.isButton()) {
            if(menu.customId === "a_one") {
              await menu.deferUpdate();
            } else if (menu.customId === "b_two") {
                await menu.deferUpdate();
                editFurnitureB(client, interaction, msg, item, type, id);
                collector.stop();
            } else if (menu.customId === "c_three") {
                await menu.deferUpdate();
                editFurnitureC(client, interaction, msg, item, type, id);
                collector.stop();
            } else if (menu.customId === "d_four") {
                await menu.deferUpdate();
                editFurnitureD(client, interaction, msg, item, type, id);
                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            const timed = new EmbedBuilder()
                .setDescription(`Time is Ended!`)
                .setColor(client.color)

            interaction.editReply({ embeds: [timed], components: [] });
        }
    });

    return;
}

const editFurnitureB = async function (client, interaction, msg, item, type, id) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const canvas = Canvas.createCanvas(300, 300);
    const ctx = canvas.getContext("2d");

    try {
        const placer = await loadImageSafely("./assests/btwo.png");
        ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
    } catch (error) {
        console.error(`Error loading btwo.png:`, error);
        return interaction.editReply({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", embeds: [], components: [] });
    }

    const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `btwo.png` })

    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setImage("attachment://btwo.png")
        .setDescription("*Please Select a Postion*")

    const select = new ActionRowBuilder()
        .addComponents([
            new StringSelectMenuBuilder()
                .setCustomId("furplace_b")
                .setPlaceholder("Placing a furniture.")
                .setMaxValues(1)
                .setMinValues(1)
                .setOptions([
                    {
                        label: "Ⓑ➀",
                        description: "Place on position B1",
                        value: "place_bone"
                    },
                    {
                        label: "Ⓑ➁",
                        description: "Place on position B2",
                        value: "place_btwo"
                    },
                    {
                        label: "Ⓑ➂",
                        description: "Place on position B3",
                        value: "place_bthree"
                    },
                    {
                        label: "Ⓑ➃",
                        description: "Place on position B4",
                        value: "place_bfour"
                    }
                ])
            ])

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("a_one")
            .setLabel("A1")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("b_two")
            .setLabel("A2")
            .setDisabled(true)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("c_three")
            .setLabel("A3")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("d_four")
            .setLabel("A4")
            .setStyle(ButtonStyle.Secondary),
        )

    await interaction.editReply({ embeds: [embed], components: [select, button], files: [attc] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    // ลบการโหลดรูปเฟอร์นิเจอร์ที่อาจไม่มีอยู่
    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isStringSelectMenu()) {
            // id select menus
            if(menu.customId === "furplace_b") {
                await menu.deferUpdate();
                /// value id
                let [ directory ] = menu.values;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                try {
                    const place_on = await loadImageSafely("./assests/default.png");
                    ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height); // and place
                } catch (error) {
                    console.error('Error loading default.png:', error);
                    return menu.followUp({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", ephemeral: true });
                }
                
                if (directory === "place_bone") {
                    /// checking position
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.B_DATA.B1 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.B_DATA.B2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.B_DATA.B1 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // save and replace
                    if(check.area === 2) {
                        home.B_DATA.B1 = true; home.B_DATA.B1I = check.name;
                        home.B_DATA.B2 = true; home.B_DATA.B2I = check.name;
                    } else {
                        home.B_DATA.B1 = true; home.B_DATA.B1I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'B1',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.B_DATA.B1 = false; home.B_DATA.B1I = "";
                                home.B_DATA.B2 = false; home.B_DATA.B2I = "";
                            } else {
                                home.B_DATA.B1 = false; home.B_DATA.B1I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveB1(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_btwo") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.B_DATA.B2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.B_DATA.B3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.B_DATA.B2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    // save and replace
                    if(check.area === 2) {
                        home.B_DATA.B2 = true; home.B_DATA.B2I = check.name;
                        home.B_DATA.B3 = true; home.B_DATA.B3I = check.name;
                    } else {
                        home.B_DATA.B2 = true; home.B_DATA.B2I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'B2',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.B_DATA.B2 = false; home.B_DATA.B2I = "";
                                home.B_DATA.B3 = false; home.B_DATA.B3I = "";
                            } else {
                                home.B_DATA.B2 = false; home.B_DATA.B2I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveB2(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_bthree") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.B_DATA.B3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.B_DATA.B4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.B_DATA.B3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    
                    // save and replace
                    if(check.area === 2) {
                        home.B_DATA.B3 = true; home.B_DATA.B3I = check.name;
                        home.B_DATA.B4 = true; home.B_DATA.B4I = check.name;
                    } else {
                        home.B_DATA.B3 = true; home.B_DATA.B3I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'B3',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.B_DATA.B3 = false; home.B_DATA.B3I = "";
                                home.B_DATA.B4 = false; home.B_DATA.B4I = "";
                            } else {
                                home.B_DATA.B3 = false; home.B_DATA.B3I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveB3(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_bfour") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.B_DATA.B4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.B_DATA.B4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    if(check.area === 2) return menu.followUp({ content: `You can't place ${check.name} on this position`, ephemeral: true })

                    // save and replace
                    home.B_DATA.B4 = true;
                    home.B_DATA.B4I = check.name;
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)
                    
                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'B4',
                        rollback: async () => {
                            home.B_DATA.B4 = false;
                            home.B_DATA.B4I = "";
                            await home.save();
                        }
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveB4(interaction, id, msg, message, check);
                    }
                    collector.stop();
                }
            }
        } else if(menu.isButton()) {
            if(menu.customId === "a_one") {
                await menu.deferUpdate();
                editFurnitureA(client, interaction, msg, item, type, id);
                collector.stop();
            } else if (menu.customId === "b_two") {
                //
            } else if (menu.customId === "c_three") {
                await menu.deferUpdate();
                editFurnitureC(client, interaction, msg, item, type, id);
                collector.stop();
            } else if (menu.customId === "d_four") {
                await menu.deferUpdate();
                editFurnitureD(client, interaction, msg, item, type, id);
                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            const timed = new EmbedBuilder()
                .setDescription(`Time is Ended!`)
                .setColor(client.color)

            interaction.editReply({ embeds: [timed], components: [] });
        }
    });

   return;
}

const editFurnitureC = async function (client, interaction, msg, item, type, id) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const canvas = Canvas.createCanvas(300, 300);
    const ctx = canvas.getContext("2d");

    try {
        const placer = await loadImageSafely("./assests/cthree.png");
        ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
    } catch (error) {
        console.error(`Error loading cthree.png:`, error);
        return interaction.editReply({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", embeds: [], components: [] });
    }

    const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `cthree.png` })

    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setImage("attachment://cthree.png")
        .setDescription("*Please Select a Postion*")

    const select = new ActionRowBuilder()
        .addComponents([
            new StringSelectMenuBuilder()
                .setCustomId("furplace_c")
                .setPlaceholder("Placing a furniture.")
                .setMaxValues(1)
                .setMinValues(1)
                .setOptions([
                    {
                        label: "Ⓒ➀",
                        description: "Place on position C1",
                        value: "place_cone"
                    },
                    {
                        label: "Ⓒ➁",
                        description: "Place on position C2",
                        value: "place_ctwo"
                    },
                    {
                        label: "Ⓒ➂",
                        description: "Place on position C3",
                        value: "place_cthree"
                    },
                    {
                        label: "Ⓒ➃",
                        description: "Place on position C4",
                        value: "place_cfour"
                    }
                ])
            ])

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("a_one")
            .setLabel("A1")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("b_two")
            .setLabel("A2")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("c_three")
            .setLabel("A3")
            .setDisabled(true)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("d_four")
            .setLabel("A4")
            .setStyle(ButtonStyle.Secondary),
        )

    await interaction.editReply({ embeds: [embed], components: [select, button], files: [attc] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    // ลบการโหลดรูปเฟอร์นิเจอร์ที่อาจไม่มีอยู่
    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isStringSelectMenu()) {
            // id select menus
            if(menu.customId === "furplace_c") {
                await menu.deferUpdate();
                /// value id
                let [ directory ] = menu.values;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                try {
                    const place_on = await loadImageSafely("./assests/default.png");
                    ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height); // and place
                } catch (error) {
                    console.error('Error loading default.png:', error);
                    return menu.followUp({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", ephemeral: true });
                }
                
                if (directory === "place_cone") {
                    /// checking position
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.C_DATA.C1 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.C_DATA.C2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.C_DATA.C1 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // save and replace
                    if(check.area === 2) {
                        home.C_DATA.C1 = true; home.C_DATA.C1I = check.name;
                        home.C_DATA.C2 = true; home.C_DATA.C2I = check.name;
                    } else {
                        home.C_DATA.C1 = true; home.C_DATA.C1I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'C1'
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveC1(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_ctwo") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.C_DATA.C2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.C_DATA.C3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.C_DATA.C2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // save and replace
                    if(check.area === 2) {
                        home.C_DATA.C2 = true; home.C_DATA.C2I = check.name;
                        home.C_DATA.C3 = true; home.C_DATA.C3I = check.name;
                    } else {
                        home.C_DATA.C2 = true; home.C_DATA.C2I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'C2'
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveC2(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_cthree") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.C_DATA.C3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.C_DATA.C4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.C_DATA.C3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    
                    // save and replace
                    if(check.area === 2) {
                        home.C_DATA.C3 = true; home.C_DATA.C3I = check.name;
                        home.C_DATA.C4 = true; home.C_DATA.C4I = check.name;
                    } else {
                        home.C_DATA.C3 = true; home.C_DATA.C3I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'C3'
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveC3(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_cfour") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.C_DATA.C4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.C_DATA.C4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    if(check.area === 2) return menu.followUp({ content: `You can't place ${check.name} on this position`, ephemeral: true })

                    // save and replace
                    home.C_DATA.C4 = true;
                    home.C_DATA.C4I = check.name;
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)
                    
                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'C4'
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveC4(interaction, id, msg, message, check);
                    }
                    collector.stop();
                }
            }
        } else if(menu.isButton()) {
            if(menu.customId === "a_one") {
                await menu.deferUpdate();
                editFurnitureA(client, interaction, msg, item, type, id);
                collector.stop();
            } else if (menu.customId === "b_two") {
                await menu.deferUpdate();
                editFurnitureB(client, interaction, msg, item, type, id);
                collector.stop();
            } else if (menu.customId === "c_three") {
                await menu.deferUpdate();
                //
            } else if (menu.customId === "d_four") {
                await menu.deferUpdate();
                editFurnitureD(client, interaction, msg, item, type, id);
                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            const timed = new EmbedBuilder()
                .setDescription(`Time is Ended!`)
                .setColor(client.color)

            interaction.editReply({ embeds: [timed], components: [] });
        }
    });

   return;
}

const editFurnitureD = async function (client, interaction, msg, item, type, id) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const canvas = Canvas.createCanvas(300, 300);
    const ctx = canvas.getContext("2d");

    try {
        const placer = await loadImageSafely("./assests/dfour.png");
        ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
    } catch (error) {
        console.error(`Error loading dfour.png:`, error);
        return interaction.editReply({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", embeds: [], components: [] });
    }

    const attc = new AttachmentBuilder(await canvas.encode("png"), { name: `dfour.png` })

    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setImage("attachment://dfour.png")
        .setDescription("*Please Select a Postion*")

    const select = new ActionRowBuilder()
        .addComponents([
            new StringSelectMenuBuilder()
                .setCustomId("furplace_d")
                .setPlaceholder("Placing a furniture.")
                .setMaxValues(1)
                .setMinValues(1)
                .setOptions([
                    {
                        label: "Ⓓ➀",
                        description: "Place on position D1",
                        value: "place_done"
                    },
                    {
                        label: "Ⓓ➁",
                        description: "Place on position D2",
                        value: "place_dtwo"
                    },
                    {
                        label: "Ⓓ➂",
                        description: "Place on position D3",
                        value: "place_dthree"
                    },
                    {
                        label: "Ⓓ➃",
                        description: "Place on position D4",
                        value: "place_dfour"
                    }
                ])
            ])

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("a_one")
            .setLabel("A1")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("b_two")
            .setLabel("A2")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("c_three")
            .setLabel("A3")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("d_four")
            .setLabel("A4")
            .setDisabled(true)
            .setStyle(ButtonStyle.Secondary),
        )

    await interaction.editReply({ embeds: [embed], components: [select, button], files: [attc] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    // ลบการโหลดรูปเฟอร์นิเจอร์ที่อาจไม่มีอยู่
    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isStringSelectMenu()) {
            // id select menus
            if(menu.customId === "furplace_d") {
                await menu.deferUpdate();
                /// value id
                let [ directory ] = menu.values;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                try {
                    const place_on = await loadImageSafely("./assests/default.png");
                    ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height); // and place
                } catch (error) {
                    console.error('Error loading default.png:', error);
                    return menu.followUp({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", ephemeral: true });
                }
                
                if (directory === "place_done") {
                    /// checking position
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.D_DATA.D1 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.D_DATA.D2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.D_DATA.D1 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // save and replace
                    if(check.area === 2) {
                        home.D_DATA.D1 = true; home.D_DATA.D1I = check.name;
                        home.D_DATA.D2 = true; home.D_DATA.D2I = check.name;
                    } else {
                        home.D_DATA.D1 = true; home.D_DATA.D1I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'D1'
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveD1(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_dtwo") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.D_DATA.D2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.D_DATA.D3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.D_DATA.D2 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    if(check.area === 2) {
                        home.D_DATA.D2 = true; home.D_DATA.D2I = check.name;
                        home.D_DATA.D3 = true; home.D_DATA.D3I = check.name;
                    } else {
                        home.D_DATA.D2 = true; home.D_DATA.D2I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'D2'
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveD2(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_dthree") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.D_DATA.D3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.D_DATA.D4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.D_DATA.D3 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    
                    // save and replace
                    if(check.area === 2) {
                        home.D_DATA.D3 = true; home.D_DATA.D3I = check.name;
                        home.D_DATA.D4 = true; home.D_DATA.D4I = check.name;
                    } else {
                        home.D_DATA.D3 = true; home.D_DATA.D3I = check.name;
                    }
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'D3'
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveD3(interaction, id, msg, message, check);
                    }
                    collector.stop();
                } else if (directory === "place_dfour") {
                    const check = inv.item.find(x => x.id === id);
                    if(check.area === 2) {
                        if (home.D_DATA.D4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.D_DATA.D4 === true) return menu.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    if(check.area === 2) return menu.followUp({ content: `You can't place ${check.name} on this position`, ephemeral: true })

                    // save and replace
                    home.D_DATA.D4 = true;
                    home.D_DATA.D4I = check.name;
                    await home.save();
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)
                    
                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'D4'
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveD4(interaction, id, msg, message, check);
                    }
                    collector.stop();
                }
            }
        } else if(menu.isButton()) {
            if(menu.customId === "a_one") {
                await menu.deferUpdate();
                editFurnitureA(client, interaction, msg, item, type, id);
                collector.stop();
            } else if (menu.customId === "b_two") {
                await menu.deferUpdate();
                editFurnitureB(client, interaction, msg, item, type, id);
                collector.stop();
            } else if (menu.customId === "c_three") {
                await menu.deferUpdate();
                editFurnitureC(client, interaction, msg, item, type, id);
                collector.stop();
            } else if (menu.customId === "d_four") {
                await menu.deferUpdate();
                //
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            const timed = new EmbedBuilder()
                .setDescription(`Time is Ended!`)
                .setColor(client.color)

            interaction.editReply({ embeds: [timed], components: [] });
        }
    });

   return;
}

module.exports = { editFurnitureA, editFurnitureB, editFurnitureC, editFurnitureD };