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
    // local check removed; assets served via CDN
    return true;
}

// ฟังก์ชันอัปเดตชื่อเฟอร์นิเจอร์ใน home object เฉพาะ slot ที่ระบุ
function updateFurnitureNameInHome(home, oldName, newName, targetSlot = null) {
    if (targetSlot) {
        // อัปเดตเฉพาะ slot ที่ระบุ
        const section = targetSlot.charAt(0); // A, B, C, D
        const number = targetSlot.charAt(1);   // 1, 2, 3, 4
        const slotName = `${section}${number}I`;
        
        if (home[`${section}_DATA`] && home[`${section}_DATA`][slotName] === oldName) {
            home[`${section}_DATA`][slotName] = newName;
        }
        return;
    }
    
    // ถ้าไม่ระบุ slot ให้อัปเดตทุก slot (สำหรับ backward compatibility)
    const updateSlot = (data, slotFlag, slotName) => {
        if (data[slotName] === oldName) {
            data[slotName] = newName;
        }
    };
    
    // อัปเดตทุก slot
    // A
    updateSlot(home.A_DATA, 'A1', 'A1I');
    updateSlot(home.A_DATA, 'A2', 'A2I');
    updateSlot(home.A_DATA, 'A3', 'A3I');
    updateSlot(home.A_DATA, 'A4', 'A4I');
    // B
    updateSlot(home.B_DATA, 'B1', 'B1I');
    updateSlot(home.B_DATA, 'B2', 'B2I');
    updateSlot(home.B_DATA, 'B3', 'B3I');
    updateSlot(home.B_DATA, 'B4', 'B4I');
    // C
    updateSlot(home.C_DATA, 'C1', 'C1I');
    updateSlot(home.C_DATA, 'C2', 'C2I');
    updateSlot(home.C_DATA, 'C3', 'C3I');
    updateSlot(home.C_DATA, 'C4', 'C4I');
    // D
    updateSlot(home.D_DATA, 'D1', 'D1I');
    updateSlot(home.D_DATA, 'D2', 'D2I');
    updateSlot(home.D_DATA, 'D3', 'D3I');
    updateSlot(home.D_DATA, 'D4', 'D4I');
}

// ล้างตำแหน่งเดิมของเฟอร์นิเจอร์ (กันกรณีrollbackไม่สำเร็จหรือกลับจาก preview)
function removeItemFromAllSlots(home, itemName) {
    const clearIfMatch = (obj, keyFlag, keyName) => {
        if (obj[keyName] === itemName) {
            obj[keyFlag] = false;
            obj[keyName] = "";
        }
    };
    // A
    clearIfMatch(home.A_DATA, 'A1', 'A1I');
    clearIfMatch(home.A_DATA, 'A2', 'A2I');
    clearIfMatch(home.A_DATA, 'A3', 'A3I');
    clearIfMatch(home.A_DATA, 'A4', 'A4I');
    // B
    clearIfMatch(home.B_DATA, 'B1', 'B1I');
    clearIfMatch(home.B_DATA, 'B2', 'B2I');
    clearIfMatch(home.B_DATA, 'B3', 'B3I');
    clearIfMatch(home.B_DATA, 'B4', 'B4I');
    // C
    clearIfMatch(home.C_DATA, 'C1', 'C1I');
    clearIfMatch(home.C_DATA, 'C2', 'C2I');
    clearIfMatch(home.C_DATA, 'C3', 'C3I');
    clearIfMatch(home.C_DATA, 'C4', 'C4I');
    // D
    clearIfMatch(home.D_DATA, 'D1', 'D1I');
    clearIfMatch(home.D_DATA, 'D2', 'D2I');
    clearIfMatch(home.D_DATA, 'D3', 'D3I');
    clearIfMatch(home.D_DATA, 'D4', 'D4I');
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
    
    // เพิ่ม flip state สำหรับเฟอร์นิเจอร์ที่กำลัง preview
    let isFlipped = false;
    
    try {
        await interaction.editReply({ content: `🧩 วางเฟอร์นิเจอร์ที่ ${positionLabel} แล้ว กำลังเรนเดอร์ Preview...`, embeds: [], components: [] });
        
        // ฟังก์ชันสำหรับเรนเดอร์ preview
        const renderPreview = async (flipped = false) => {
            // สร้าง home copy เพื่อแก้ไขชื่อเฟอร์นิเจอร์ชั่วคราว
            const homeCopy = JSON.parse(JSON.stringify(home));
            
            // เปลี่ยนชื่อเฟอร์นิเจอร์ที่กำลัง preview
            if (flipped) {
                // เปลี่ยนจาก _left เป็น _right หรือเพิ่ม _right ถ้าไม่มี suffix
                const currentName = check.name;
                const newName = currentName.endsWith('_left') 
                    ? currentName.replace('_left', '_right')
                    : currentName.endsWith('_right')
                    ? currentName.replace('_right', '_left')
                    : currentName + '_right';
                
                // อัปเดตชื่อใน home copy เฉพาะ slot ที่กำลัง preview
                updateFurnitureNameInHome(homeCopy, currentName, newName, positionLabel);
            }
            
            const payload = {
                guild: interaction.guild.id,
                user: interaction.user.id,
                size: { width: 300, height: 300 },
                format: 'png',
                layers: buildHouseLayers(homeCopy),
                debug: { checkName: check.name, flipped, currentName: check.name }
            };
            console.log('Rendering with furniture name:', flipped ? 'flipped' : 'normal', 'for furniture:', check.name);
            const { jobId } = await queue.enqueue(payload);
            return await queue.waitForResult(jobId);
        };
        
        const result = await renderPreview(isFlipped);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('preview_save_fur').setLabel('Save').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('preview_flip_fur').setLabel('🔄 Flip').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('preview_back_fur').setLabel('Back').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('preview_cancel_fur').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );
        const { fetchBuffer } = require('../services/discordUpload');
        const buf = await fetchBuffer(result.url);
        const att = new AttachmentBuilder(buf, { name: 'preview.png' });
        const embedPrev = new EmbedBuilder().setTitle('House Preview').setImage('attachment://preview.png').setColor(client.color);
        await interaction.editReply({ content: " ", embeds: [embedPrev], components: [row], files: [att] });

        const filter = (m) => m.user.id === interaction.user.id;
        const collector = await msg.createMessageComponentCollector({ filter, time: 300000 });
        let closed = false; // guard to prevent any action after cancel/back
        collector.on('collect', async (i) => {
            if (closed) { try { await i.deferUpdate(); } catch {} return; }
            await i.deferUpdate();
            if (i.customId === 'preview_save_fur') {
                closed = true;
                
                // อัปเดตชื่อเฟอร์นิเจอร์ใน home ถ้า flip แล้ว
                if (isFlipped) {
                    const currentName = check.name;
                    const newName = currentName.endsWith('_left') 
                        ? currentName.replace('_left', '_right')
                        : currentName.endsWith('_right')
                        ? currentName.replace('_right', '_left')
                        : currentName + '_right';
                    
                    updateFurnitureNameInHome(home, currentName, newName, positionLabel);
                }
                
                // commit: remove item from inv, save URL
                const itemIndex = inv.item.findIndex(x => x.id === check.id);
                if (itemIndex !== -1) {
                    inv.item.splice(itemIndex, 1);
                }
                await inv.save();
                
                // เรนเดอร์ครั้งสุดท้ายด้วยสถานะ flip ปัจจุบัน
                const finalResult = await renderPreview(isFlipped);
                let finalUrl = finalResult.url;
                if (isLocalServiceUrl(finalUrl, process.env.RENDER_SERVICE_URL)) {
                    const uploaded = await uploadFromUrlToInteraction(interaction, finalUrl, `house.${finalResult.format === 'gif' ? 'gif' : 'png'}`);
                    if (uploaded) finalUrl = uploaded;
                }
                home.house = finalUrl;
                await home.save();
                const savedEmbed = new EmbedBuilder().setColor(client.color).setDescription('House has saved.');
                await interaction.editReply({ embeds: [savedEmbed], components: [], files: [] });
                collector.stop();
            } else if (i.customId === 'preview_flip_fur') {
                // เปลี่ยนสถานะ flip และเรนเดอร์ใหม่
                isFlipped = !isFlipped;
                await interaction.editReply({ content: `🔄 กำลังพลิกเฟอร์นิเจอร์...`, embeds: [], components: [] });
                
                try {
                    const newResult = await renderPreview(isFlipped);
                    const { fetchBuffer } = require('../services/discordUpload');
                    const buf = await fetchBuffer(newResult.url);
                    const att = new AttachmentBuilder(buf, { name: 'preview.png' });
                    const embedPrev = new EmbedBuilder()
                        .setTitle('House Preview')
                        .setImage('attachment://preview.png')
                        .setColor(client.color)
                        .setDescription(isFlipped ? 'เฟอร์นิเจอร์ถูกพลิกแล้ว' : 'เฟอร์นิเจอร์กลับสู่สถานะปกติ');
                    
                    await interaction.editReply({ content: " ", embeds: [embedPrev], components: [row], files: [att] });
                } catch (error) {
                    console.error('Error flipping furniture:', error);
                    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการพลิกเฟอร์นิเจอร์', embeds: [], components: [] });
                }
            } else if (i.customId === 'preview_back_fur') {
                closed = true;
                // stop preview collector first to avoid races
                collector.stop();
                
                // ถ้า flip แล้ว ให้เก็บข้อมูล flip state ไว้ก่อน rollback
                if (isFlipped) {
                    const currentName = check.name;
                    const flippedName = currentName.endsWith('_left') 
                        ? currentName.replace('_left', '_right')
                        : currentName.endsWith('_right')
                        ? currentName.replace('_right', '_left')
                        : currentName + '_right';
                    
                    // อัปเดตชื่อใน home เพื่อเก็บ flip state
                    updateFurnitureNameInHome(home, currentName, flippedName, positionLabel);
                    await home.save();
                }
                
                // rollback and return to slot selection for the same item
                if (rollback) await rollback();
                const section = String(positionLabel || '').charAt(0).toUpperCase();
                
                // ใช้ชื่อที่ถูก flip แล้วถ้ามี
                let itemName = check && check.name ? check.name : undefined;
                if (isFlipped && itemName) {
                    itemName = itemName.endsWith('_left') 
                        ? itemName.replace('_left', '_right')
                        : itemName.endsWith('_right')
                        ? itemName.replace('_right', '_left')
                        : itemName + '_right';
                }
                
                const itemType = check && check.type ? check.type : undefined;
                const itemId = check && check.id ? check.id : undefined;
                // Clear preview UI first
                await interaction.editReply({ content: 'เลือกตำแหน่งใหม่', embeds: [], components: [], files: [] });
                // ไม่ล้างทั้งหมดเพื่อไม่กระทบของที่ Save ไปแล้ว (rollback ดูแลเฉพาะวางล่าสุด)
                // yield to event loop to ensure new collectors can attach before user types
                await new Promise(r => setTimeout(r, 25));
                if (section === 'A') return editFurnitureA(client, interaction, msg, itemName, itemType, itemId);
                if (section === 'B') return editFurnitureB(client, interaction, msg, itemName, itemType, itemId);
                if (section === 'C') return editFurnitureC(client, interaction, msg, itemName, itemType, itemId);
                if (section === 'D') return editFurnitureD(client, interaction, msg, itemName, itemType, itemId);
                return editFurnitureA(client, interaction, msg, itemName, itemType, itemId);
            } else if (i.customId === 'preview_cancel_fur') {
                closed = true;
                // rollback state
                if (rollback) await rollback();
                const cancelEmbed = new EmbedBuilder().setColor(client.color).setDescription('ยกเลิกแล้ว');
                await interaction.editReply({ embeds: [cancelEmbed], components: [], files: [] });
                collector.stop();
            }
        });
        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                closed = true;
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

    // load current home and inventory for this user
    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    // แสดงรูปบ้านปัจจุบันเท่านั้น และให้พิมพ์ A1-D4
    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription("พิมพ์ตำแหน่งที่ต้องการวาง เช่น A1, B2, C3, D4")
    if (home && home.house) {
        try {
            let finalUrl = home.house;
            if (isLocalServiceUrl(finalUrl, process.env.RENDER_SERVICE_URL)) {
                const { fetchBuffer } = require('../services/discordUpload');
                const buf = await fetchBuffer(finalUrl);
                const name = finalUrl.endsWith('.gif') ? 'house.gif' : 'house.png';
                const att = new AttachmentBuilder(buf, { name });
                embed.setImage(`attachment://${name}`);
                await interaction.editReply({ embeds: [embed], components: [], files: [att] });
            } else {
                embed.setImage(finalUrl);
                await interaction.editReply({ embeds: [embed], components: [], files: [] });
            }
        } catch (e) {
            console.error('Failed to display current house image, falling back to default:', e);
            await interaction.editReply({ embeds: [embed], components: [], files: [] });
        }
    } else {
        try {
            const placer = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
        ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
            const att = new AttachmentBuilder(await canvas.encode("png"), { name: `house.png` })
            embed.setImage("attachment://house.png");
            await interaction.editReply({ embeds: [embed], components: [], files: [att] });
    } catch (error) {
            console.error('Error loading default.png:', error);
            await interaction.editReply({ embeds: [embed], components: [], files: [] });
        }
    }

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    // ใช้การพิมพ์ A1-D4 แทน select menu
    const msgFilter = (m) => m.author && m.author.id === interaction.user.id;
    const messageCollector = interaction.channel.createMessageCollector({ filter: msgFilter, time: 300000 });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            if(menu.customId === "a_one") {
                await menu.deferUpdate();
            } else if (menu.customId === "b_two") {
                await menu.deferUpdate();
                editFurnitureB(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollector.stop();
            } else if (menu.customId === "c_three") {
                await menu.deferUpdate();
                editFurnitureC(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollector.stop();
            } else if (menu.customId === "d_four") {
                await menu.deferUpdate();
                editFurnitureD(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollector.stop();
            }
        }
    });

    messageCollector.on('collect', async (m) => {
        const raw = (m.content || '').trim().toUpperCase();
        const posMatch = /^(A|B|C|D)([1-4])$/.exec(raw);
        if (!posMatch) {
            const warn = await m.reply({ content: 'โปรดพิมพ์ตำแหน่งเป็นรูปแบบ A1-D4 เท่านั้น', allowedMentions: { repliedUser: false } }).catch(() => null);
            if (warn && warn.delete) { try { await warn.delete().catch(() => {}); } catch {} }
            try { await m.delete().catch(() => {}); } catch {}
            return;
        }
        const section = posMatch[1];
        const number = parseInt(posMatch[2], 10);
        // หากไม่ใช่แถว A ให้เปลี่ยนไปยังฟังก์ชันของแถวนั้น
        if (section === 'B') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollector.stop(); return editFurnitureB(client, interaction, msg, item, type, id); }
        if (section === 'C') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollector.stop(); return editFurnitureC(client, interaction, msg, item, type, id); }
        if (section === 'D') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollector.stop(); return editFurnitureD(client, interaction, msg, item, type, id); }

        // ดำเนินการสำหรับ A1-A4
        ctx.clearRect(0, 0, canvas.width, canvas.height);
                try {
                    const place_on = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
            ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height);
                } catch (error) {
                    console.error('Error loading default.png:', error);
            try { await m.delete().catch(() => {}); } catch {}
            return interaction.followUp({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", ephemeral: true });
                }
                
        if (number === 1) {
                    /// checking position
                    const check = inv.item.find(x => x.id === id);
                    // block if poop exists on targeted slots
                // allow placing over poop: removed POOP_DATA checks for A1/A2 span
                    if(check.area === 2) {
                        if (home.A_DATA.A1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.B_DATA.B1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.A_DATA.A1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // temporarily place furniture (don't save yet)
                    if(check.area === 2) {
                        home.A_DATA.A1 = true; home.A_DATA.A1I = check.name;
                        home.B_DATA.B1 = true; home.B_DATA.B1I = check.name;
                    } else {
                        home.A_DATA.A1 = true; home.A_DATA.A1I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(client.color).setDescription('เลือกตำแหน่ง A1 แล้ว กำลัง Preview...')], components: [], files: [] });
                    // stop current collectors before entering preview to avoid race
                    try { collector.stop(); messageCollector.stop(); } catch {}
                    try { collector.stop(); messageCollectorB.stop(); } catch {}
                    try { collector.stop(); messageCollectorC.stop(); } catch {}
                    try { collector.stop(); messageCollectorD.stop(); } catch {}
                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'A1',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.A_DATA.A1 = false; home.A_DATA.A1I = "";
                                home.B_DATA.B1 = false; home.B_DATA.B1I = "";
                            } else {
                                home.A_DATA.A1 = false; home.A_DATA.A1I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.A_DATA.A1 = false; home.A_DATA.A1I = "";
                            home.B_DATA.B1 = false; home.B_DATA.B1I = "";
                        } else {
                            home.A_DATA.A1 = false; home.A_DATA.A1I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollector.stop();
                } else if (number === 2) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: removed POOP_DATA checks for A2/A3 span
                    if(check.area === 2) {
                        if (home.A_DATA.A2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.B_DATA.B2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.A_DATA.A2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    // temporarily place furniture (don't save yet)
                    if(check.area === 2) {
                        home.A_DATA.A2 = true; home.A_DATA.A2I = check.name;
                        home.B_DATA.B2 = true; home.B_DATA.B2I = check.name;
                    } else {
                        home.A_DATA.A2 = true; home.A_DATA.A2I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(client.color).setDescription('เลือกตำแหน่ง A2 แล้ว กำลัง Preview...')], components: [], files: [] });
                    try { collector.stop(); messageCollector.stop(); } catch {}
                    try { collector.stop(); messageCollectorB.stop(); } catch {}
                    try { collector.stop(); messageCollectorC.stop(); } catch {}
                    try { collector.stop(); messageCollectorD.stop(); } catch {}
                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'A2',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.A_DATA.A2 = false; home.A_DATA.A2I = "";
                                home.B_DATA.B2 = false; home.B_DATA.B2I = "";
                            } else {
                                home.A_DATA.A2 = false; home.A_DATA.A2I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.A_DATA.A2 = false; home.A_DATA.A2I = "";
                            home.B_DATA.B2 = false; home.B_DATA.B2I = "";
                        } else {
                            home.A_DATA.A2 = false; home.A_DATA.A2I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollector.stop();
                } else if (number === 3) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: removed POOP_DATA checks for A3/A4 span
                    if(check.area === 2) {
                        if (home.A_DATA.A3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.B_DATA.B3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.A_DATA.A3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    
                    // temporarily place furniture (don't save yet)
                    if(check.area === 2) {
                        home.A_DATA.A3 = true; home.A_DATA.A3I = check.name;
                        home.B_DATA.B3 = true; home.B_DATA.B3I = check.name;
                    } else {
                        home.A_DATA.A3 = true; home.A_DATA.A3I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(client.color).setDescription('เลือกตำแหน่ง A3 แล้ว กำลัง Preview...')], components: [], files: [] });
                    try { collector.stop(); messageCollector.stop(); } catch {}
                    try { collector.stop(); messageCollectorB.stop(); } catch {}
                    try { collector.stop(); messageCollectorC.stop(); } catch {}
                    try { collector.stop(); messageCollectorD.stop(); } catch {}
                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'A3',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.A_DATA.A3 = false; home.A_DATA.A3I = "";
                                home.B_DATA.B3 = false; home.B_DATA.B3I = "";
                            } else {
                                home.A_DATA.A3 = false; home.A_DATA.A3I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.A_DATA.A3 = false; home.A_DATA.A3I = "";
                            home.B_DATA.B3 = false; home.B_DATA.B3I = "";
                        } else {
                            home.A_DATA.A3 = false; home.A_DATA.A3I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollector.stop();
                } else if (number === 4) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop at A4: removed POOP_DATA check
                    if(check.area === 2) {
                        if (home.A_DATA.A4 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.A_DATA.A4 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    if(check.area === 2) return interaction.followUp({ content: `You can't place ${check.name} on this position`, ephemeral: true })

                    // temporarily place furniture (don't save yet)
                    home.A_DATA.A4 = true;
                    home.A_DATA.A4I = check.name;
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)
                    
                    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(client.color).setDescription('เลือกตำแหน่ง A4 แล้ว กำลัง Preview...')], components: [], files: [] });
                    try { collector.stop(); messageCollector.stop(); } catch {}
                    try { collector.stop(); messageCollectorB.stop(); } catch {}
                    try { collector.stop(); messageCollectorC.stop(); } catch {}
                    try { collector.stop(); messageCollectorD.stop(); } catch {}
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
                        // rollback if preview failed
                        home.A_DATA.A4 = false;
                        home.A_DATA.A4I = "";
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollector.stop();
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
        const placer = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/btwo.png");
        ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
    } catch (error) {
        console.error(`Error loading btwo.png:`, error);
        return interaction.editReply({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", embeds: [], components: [] });
    }

    // load current home and inventory for this user
    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription("พิมพ์ตำแหน่งที่ต้องการวาง เช่น A1, B2, C3, D4")
    if (home && home.house) {
        try {
            let finalUrl = home.house;
            if (isLocalServiceUrl(finalUrl, process.env.RENDER_SERVICE_URL)) {
                const { fetchBuffer } = require('../services/discordUpload');
                const buf = await fetchBuffer(finalUrl);
                const name = finalUrl.endsWith('.gif') ? 'house.gif' : 'house.png';
                const att = new AttachmentBuilder(buf, { name });
                embed.setImage(`attachment://${name}`);
                await interaction.editReply({ embeds: [embed], components: [], files: [att] });
            } else {
                embed.setImage(finalUrl);
                await interaction.editReply({ embeds: [embed], components: [], files: [] });
            }
        } catch (e) {
            console.error('Failed to display current house image, falling back to default:', e);
            await interaction.editReply({ embeds: [embed], components: [], files: [] });
        }
    } else {
        try {
            const placer = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
            ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
            const att = new AttachmentBuilder(await canvas.encode("png"), { name: `house.png` })
            embed.setImage("attachment://house.png");
            await interaction.editReply({ embeds: [embed], components: [], files: [att] });
        } catch (error) {
            console.error('Error loading default.png:', error);
            await interaction.editReply({ embeds: [embed], components: [], files: [] });
        }
    }

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    // message input path for B section
    const msgFilterB = (m) => m.author && m.author.id === interaction.user.id;
    const messageCollectorB = interaction.channel.createMessageCollector({ filter: msgFilterB, time: 300000 });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            if(menu.customId === "a_one") {
                await menu.deferUpdate();
                editFurnitureA(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollectorB.stop();
            } else if (menu.customId === "b_two") {
                await menu.deferUpdate();
            } else if (menu.customId === "c_three") {
                await menu.deferUpdate();
                editFurnitureC(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollectorB.stop();
            } else if (menu.customId === "d_four") {
                await menu.deferUpdate();
                editFurnitureD(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollectorB.stop();
            }
        }
    });

    messageCollectorB.on('collect', async (m) => {
        const raw = (m.content || '').trim().toUpperCase();
        const posMatch = /^(A|B|C|D)([1-4])$/.exec(raw);
        if (!posMatch) {
            const warn = await m.reply({ content: 'โปรดพิมพ์ตำแหน่งเป็นรูปแบบ A1-D4 เท่านั้น', allowedMentions: { repliedUser: false } }).catch(() => null);
            if (warn && warn.delete) { try { await warn.delete().catch(() => {}); } catch {} }
            try { await m.delete().catch(() => {}); } catch {}
            return;
        }
        const section = posMatch[1];
        const number = parseInt(posMatch[2], 10);
        if (section === 'A') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollectorB.stop(); return editFurnitureA(client, interaction, msg, item, type, id); }
        if (section === 'C') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollectorB.stop(); return editFurnitureC(client, interaction, msg, item, type, id); }
        if (section === 'D') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollectorB.stop(); return editFurnitureD(client, interaction, msg, item, type, id); }

        // For B1-B4
        ctx.clearRect(0, 0, canvas.width, canvas.height);
                try {
                    const place_on = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
            ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height);
                } catch (error) {
                    console.error('Error loading default.png:', error);
            try { await m.delete().catch(() => {}); } catch {}
            return interaction.followUp({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", ephemeral: true });
                }
                
        if (number === 1) {
                    /// checking position
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.B_DATA.B1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.C_DATA.C1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.B_DATA.B1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // temporarily place furniture (don't save yet)
                    if(check.area === 2) {
                        home.B_DATA.B1 = true; home.B_DATA.B1I = check.name;
                        home.C_DATA.C1 = true; home.C_DATA.C1I = check.name;
                    } else {
                        home.B_DATA.B1 = true; home.B_DATA.B1I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'B1',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.B_DATA.B1 = false; home.B_DATA.B1I = "";
                                home.C_DATA.C1 = false; home.C_DATA.C1I = "";
                            } else {
                                home.B_DATA.B1 = false; home.B_DATA.B1I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.B_DATA.B1 = false; home.B_DATA.B1I = "";
                            home.C_DATA.C1 = false; home.C_DATA.C1I = "";
                        } else {
                            home.B_DATA.B1 = false; home.B_DATA.B1I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorB.stop();
        } else if (number === 2) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.B_DATA.B2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.C_DATA.C2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.B_DATA.B2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    // temporarily place furniture (don't save yet)
                    if(check.area === 2) {
                        home.B_DATA.B2 = true; home.B_DATA.B2I = check.name;
                        home.C_DATA.C2 = true; home.C_DATA.C2I = check.name;
                    } else {
                        home.B_DATA.B2 = true; home.B_DATA.B2I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'B2',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.B_DATA.B2 = false; home.B_DATA.B2I = "";
                                home.C_DATA.C2 = false; home.C_DATA.C2I = "";
                            } else {
                                home.B_DATA.B2 = false; home.B_DATA.B2I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.B_DATA.B2 = false; home.B_DATA.B2I = "";
                            home.C_DATA.C2 = false; home.C_DATA.C2I = "";
                        } else {
                            home.B_DATA.B2 = false; home.B_DATA.B2I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorB.stop();
        } else if (number === 3) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.B_DATA.B3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.C_DATA.C3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.B_DATA.B3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    
                    // temporarily place furniture (don't save yet)
                    if(check.area === 2) {
                        home.B_DATA.B3 = true; home.B_DATA.B3I = check.name;
                        home.C_DATA.C3 = true; home.C_DATA.C3I = check.name;
                    } else {
                        home.B_DATA.B3 = true; home.B_DATA.B3I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'B3',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.B_DATA.B3 = false; home.B_DATA.B3I = "";
                                home.C_DATA.C3 = false; home.C_DATA.C3I = "";
                            } else {
                                home.B_DATA.B3 = false; home.B_DATA.B3I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.B_DATA.B3 = false; home.B_DATA.B3I = "";
                            home.C_DATA.C3 = false; home.C_DATA.C3I = "";
                        } else {
                            home.B_DATA.B3 = false; home.B_DATA.B3I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorB.stop();
        } else if (number === 4) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop at B4: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.B_DATA.B4 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.B_DATA.B4 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    if(check.area === 2) return interaction.followUp({ content: `You can't place ${check.name} on this position`, ephemeral: true })

                    // temporarily place furniture (don't save yet)
                    home.B_DATA.B4 = true;
                    home.B_DATA.B4I = check.name;
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
                        // rollback if preview failed
                        home.B_DATA.B4 = false;
                        home.B_DATA.B4I = "";
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorB.stop();
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
        const placer = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/cthree.png");
        ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
    } catch (error) {
        console.error(`Error loading cthree.png:`, error);
        return interaction.editReply({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", embeds: [], components: [] });
    }

    // load current home and inventory for this user
    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription("พิมพ์ตำแหน่งที่ต้องการวาง เช่น A1, B2, C3, D4")
    if (home && home.house) {
        try {
            let finalUrl = home.house;
            if (isLocalServiceUrl(finalUrl, process.env.RENDER_SERVICE_URL)) {
                const { fetchBuffer } = require('../services/discordUpload');
                const buf = await fetchBuffer(finalUrl);
                const name = finalUrl.endsWith('.gif') ? 'house.gif' : 'house.png';
                const att = new AttachmentBuilder(buf, { name });
                embed.setImage(`attachment://${name}`);
                await interaction.editReply({ embeds: [embed], components: [], files: [att] });
            } else {
                embed.setImage(finalUrl);
                await interaction.editReply({ embeds: [embed], components: [], files: [] });
            }
        } catch (e) {
            console.error('Failed to display current house image, falling back to default:', e);
            await interaction.editReply({ embeds: [embed], components: [], files: [] });
        }
    } else {
        try {
            const placer = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
            ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
            const att = new AttachmentBuilder(await canvas.encode("png"), { name: `house.png` })
            embed.setImage("attachment://house.png");
            await interaction.editReply({ embeds: [embed], components: [], files: [att] });
        } catch (error) {
            console.error('Error loading default.png:', error);
            await interaction.editReply({ embeds: [embed], components: [], files: [] });
        }
    }

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    // ลบการโหลดรูปเฟอร์นิเจอร์ที่อาจไม่มีอยู่
    // reuse previously loaded home/inv above in this function (declared earlier)

    // message input path for C section
    const msgFilterC = (m) => m.author && m.author.id === interaction.user.id;
    const messageCollectorC = interaction.channel.createMessageCollector({ filter: msgFilterC, time: 300000 });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            if(menu.customId === "a_one") {
                await menu.deferUpdate();
                editFurnitureA(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollectorC.stop();
            } else if (menu.customId === "b_two") {
                await menu.deferUpdate();
                editFurnitureB(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollectorC.stop();
            } else if (menu.customId === "c_three") {
                await menu.deferUpdate();
            } else if (menu.customId === "d_four") {
                await menu.deferUpdate();
                editFurnitureD(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollectorC.stop();
            }
        }
    });

    messageCollectorC.on('collect', async (m) => {
        const raw = (m.content || '').trim().toUpperCase();
        const posMatch = /^(A|B|C|D)([1-4])$/.exec(raw);
        if (!posMatch) {
            const warn = await m.reply({ content: 'โปรดพิมพ์ตำแหน่งเป็นรูปแบบ A1-D4 เท่านั้น', allowedMentions: { repliedUser: false } }).catch(() => null);
            if (warn && warn.delete) { try { await warn.delete().catch(() => {}); } catch {} }
            try { await m.delete().catch(() => {}); } catch {}
            return;
        }
        const section = posMatch[1];
        const number = parseInt(posMatch[2], 10);
        if (section === 'A') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollectorC.stop(); return editFurnitureA(client, interaction, msg, item, type, id); }
        if (section === 'B') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollectorC.stop(); return editFurnitureB(client, interaction, msg, item, type, id); }
        if (section === 'D') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollectorC.stop(); return editFurnitureD(client, interaction, msg, item, type, id); }

        // For C1-C4
        ctx.clearRect(0, 0, canvas.width, canvas.height);
                try {
                    const place_on = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
            ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height);
                } catch (error) {
                    console.error('Error loading default.png:', error);
            try { await m.delete().catch(() => {}); } catch {}
            return interaction.followUp({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", ephemeral: true });
                }
                
        if (number === 1) {
                    /// checking position
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.C_DATA.C1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.D_DATA.D1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.C_DATA.C1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // temporarily place furniture (don't save yet)
                    if(check.area === 2) {
                        home.C_DATA.C1 = true; home.C_DATA.C1I = check.name;
                        home.D_DATA.D1 = true; home.D_DATA.D1I = check.name;
                    } else {
                        home.C_DATA.C1 = true; home.C_DATA.C1I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'C1',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.C_DATA.C1 = false; home.C_DATA.C1I = "";
                                home.D_DATA.D1 = false; home.D_DATA.D1I = "";
                            } else {
                                home.C_DATA.C1 = false; home.C_DATA.C1I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        const build = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` })
                        const message = await interaction.editReply({ embeds: [], components: [], files: [build] });
                        await saveC1(interaction, id, msg, message, check);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorC.stop();
        } else if (number === 2) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.C_DATA.C2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.D_DATA.D2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.C_DATA.C2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // temporarily place furniture (don't save yet)
                    if(check.area === 2) {
                        home.C_DATA.C2 = true; home.C_DATA.C2I = check.name;
                        home.D_DATA.D2 = true; home.D_DATA.D2I = check.name;
                    } else {
                        home.C_DATA.C2 = true; home.C_DATA.C2I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'C2',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.C_DATA.C2 = false; home.C_DATA.C2I = "";
                                home.D_DATA.D2 = false; home.D_DATA.D2I = "";
                            } else {
                                home.C_DATA.C2 = false; home.C_DATA.C2I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.C_DATA.C2 = false; home.C_DATA.C2I = "";
                            home.D_DATA.D2 = false; home.D_DATA.D2I = "";
                        } else {
                            home.C_DATA.C2 = false; home.C_DATA.C2I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorC.stop();
        } else if (number === 3) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.C_DATA.C3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.D_DATA.D3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.C_DATA.C3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    
                    // temporarily place furniture (don't save yet)
                    if(check.area === 2) {
                        home.C_DATA.C3 = true; home.C_DATA.C3I = check.name;
                        home.D_DATA.D3 = true; home.D_DATA.D3I = check.name;
                    } else {
                        home.C_DATA.C3 = true; home.C_DATA.C3I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'C3',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.C_DATA.C3 = false; home.C_DATA.C3I = "";
                                home.D_DATA.D3 = false; home.D_DATA.D3I = "";
                            } else {
                                home.C_DATA.C3 = false; home.C_DATA.C3I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.C_DATA.C3 = false; home.C_DATA.C3I = "";
                            home.D_DATA.D3 = false; home.D_DATA.D3I = "";
                        } else {
                            home.C_DATA.C3 = false; home.C_DATA.C3I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorC.stop();
        } else if (number === 4) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop at C4: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.C_DATA.C4 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.C_DATA.C4 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    if(check.area === 2) return interaction.followUp({ content: `You can't place ${check.name} on this position`, ephemeral: true })

                    // temporarily place furniture (don't save yet)
                    home.C_DATA.C4 = true;
                    home.C_DATA.C4I = check.name;
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)
                    
                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'C4',
                        rollback: async () => {
                            home.C_DATA.C4 = false;
                            home.C_DATA.C4I = "";
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        home.C_DATA.C4 = false;
                        home.C_DATA.C4I = "";
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorC.stop();
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
        const placer = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/dfour.png");
        ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
    } catch (error) {
        console.error(`Error loading dfour.png:`, error);
        return interaction.editReply({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", embeds: [], components: [] });
    }

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription("พิมพ์ตำแหน่งที่ต้องการวาง เช่น A1, B2, C3, D4")
    if (home && home.house) {
        try {
            let finalUrl = home.house;
            if (isLocalServiceUrl(finalUrl, process.env.RENDER_SERVICE_URL)) {
                const { fetchBuffer } = require('../services/discordUpload');
                const buf = await fetchBuffer(finalUrl);
                const name = finalUrl.endsWith('.gif') ? 'house.gif' : 'house.png';
                const att = new AttachmentBuilder(buf, { name });
                embed.setImage(`attachment://${name}`);
                await interaction.editReply({ embeds: [embed], components: [], files: [att] });
            } else {
                embed.setImage(finalUrl);
                await interaction.editReply({ embeds: [embed], components: [], files: [] });
            }
        } catch (e) {
            console.error('Failed to display current house image, falling back to default:', e);
            await interaction.editReply({ embeds: [embed], components: [], files: [] });
        }
    } else {
        try {
            const placer = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
            ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
            const att = new AttachmentBuilder(await canvas.encode("png"), { name: `house.png` })
            embed.setImage("attachment://house.png");
            await interaction.editReply({ embeds: [embed], components: [], files: [att] });
        } catch (error) {
            console.error('Error loading default.png:', error);
            await interaction.editReply({ embeds: [embed], components: [], files: [] });
        }
    }

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    // ลบการโหลดรูปเฟอร์นิเจอร์ที่อาจไม่มีอยู่ (reuse home/inv declared above)

    // message input path for D section
    const msgFilterD = (m) => m.author && m.author.id === interaction.user.id;
    const messageCollectorD = interaction.channel.createMessageCollector({ filter: msgFilterD, time: 300000 });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            if(menu.customId === "a_one") {
                await menu.deferUpdate();
                editFurnitureA(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollectorD.stop();
            } else if (menu.customId === "b_two") {
                await menu.deferUpdate();
                editFurnitureB(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollectorD.stop();
            } else if (menu.customId === "c_three") {
                await menu.deferUpdate();
                editFurnitureC(client, interaction, msg, item, type, id);
                collector.stop();
                messageCollectorD.stop();
            } else if (menu.customId === "d_four") {
                await menu.deferUpdate();
            }
        }
    });

    messageCollectorD.on('collect', async (m) => {
        const raw = (m.content || '').trim().toUpperCase();
        const posMatch = /^(A|B|C|D)([1-4])$/.exec(raw);
        if (!posMatch) {
            const warn = await m.reply({ content: 'โปรดพิมพ์ตำแหน่งเป็นรูปแบบ A1-D4 เท่านั้น', allowedMentions: { repliedUser: false } }).catch(() => null);
            if (warn && warn.delete) { try { await warn.delete().catch(() => {}); } catch {} }
            try { await m.delete().catch(() => {}); } catch {}
            return;
        }
        const section = posMatch[1];
        const number = parseInt(posMatch[2], 10);
        if (section === 'A') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollectorD.stop(); return editFurnitureA(client, interaction, msg, item, type, id); }
        if (section === 'B') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollectorD.stop(); return editFurnitureB(client, interaction, msg, item, type, id); }
        if (section === 'C') { try { await m.delete().catch(() => {}); } catch {}; collector.stop(); messageCollectorD.stop(); return editFurnitureC(client, interaction, msg, item, type, id); }

        // For D1-D4
        ctx.clearRect(0, 0, canvas.width, canvas.height);
                try {
                    const place_on = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
            ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height);
                } catch (error) {
                    console.error('Error loading default.png:', error);
            try { await m.delete().catch(() => {}); } catch {}
            return interaction.followUp({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", ephemeral: true });
                }
                
        if (number === 1) {
                    /// checking position
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.D_DATA.D1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.D_DATA.D2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.D_DATA.D1 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }

                    // temporarily place furniture (don't save yet)
                    // D1 can place 2x2 furniture vertically (D1-D2)
                    if(check.area === 2) {
                        home.D_DATA.D1 = true; home.D_DATA.D1I = check.name;
                        home.D_DATA.D2 = true; home.D_DATA.D2I = check.name;
                    } else {
                        home.D_DATA.D1 = true; home.D_DATA.D1I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'D1',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.D_DATA.D1 = false; home.D_DATA.D1I = "";
                                home.D_DATA.D2 = false; home.D_DATA.D2I = "";
                            } else {
                                home.D_DATA.D1 = false; home.D_DATA.D1I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.D_DATA.D1 = false; home.D_DATA.D1I = "";
                            home.D_DATA.D2 = false; home.D_DATA.D2I = "";
                        } else {
                            home.D_DATA.D1 = false; home.D_DATA.D1I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorD.stop();
        } else if (number === 2) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.D_DATA.D2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.D_DATA.D3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.D_DATA.D2 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    // D2 can place 2x2 furniture vertically (D2-D3)
                    if(check.area === 2) {
                        home.D_DATA.D2 = true; home.D_DATA.D2I = check.name;
                        home.D_DATA.D3 = true; home.D_DATA.D3I = check.name;
                    } else {
                        home.D_DATA.D2 = true; home.D_DATA.D2I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'D2',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.D_DATA.D2 = false; home.D_DATA.D2I = "";
                                home.D_DATA.D3 = false; home.D_DATA.D3I = "";
                            } else {
                                home.D_DATA.D2 = false; home.D_DATA.D2I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.D_DATA.D2 = false; home.D_DATA.D2I = "";
                            home.D_DATA.D3 = false; home.D_DATA.D3I = "";
                        } else {
                            home.D_DATA.D2 = false; home.D_DATA.D2I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorD.stop();
        } else if (number === 3) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.D_DATA.D3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                        if (home.D_DATA.D4 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.D_DATA.D3 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    
                    // temporarily place furniture (don't save yet)
                    // D3 can place 2x2 furniture vertically (D3-D4)
                    if(check.area === 2) {
                        home.D_DATA.D3 = true; home.D_DATA.D3I = check.name;
                        home.D_DATA.D4 = true; home.D_DATA.D4I = check.name;
                    } else {
                        home.D_DATA.D3 = true; home.D_DATA.D3I = check.name;
                    }
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)

                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'D3',
                        rollback: async () => {
                            if(check.area === 2) {
                                home.D_DATA.D3 = false; home.D_DATA.D3I = "";
                                home.D_DATA.D4 = false; home.D_DATA.D4I = "";
                            } else {
                                home.D_DATA.D3 = false; home.D_DATA.D3I = "";
                            }
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        if(check.area === 2) {
                            home.D_DATA.D3 = false; home.D_DATA.D3I = "";
                            home.D_DATA.D4 = false; home.D_DATA.D4I = "";
                        } else {
                            home.D_DATA.D3 = false; home.D_DATA.D3I = "";
                        }
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorD.stop();
        } else if (number === 4) {
                    const check = inv.item.find(x => x.id === id);
                    // allow placing over poop at D4: no POOP_DATA checks
                    if(check.area === 2) {
                        if (home.D_DATA.D4 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    } else {
                        if (home.D_DATA.D4 === true) return interaction.followUp({ content: "You can't place this position.", ephemeral: true });
                    }
                    if(check.area === 2) return interaction.followUp({ content: `You can't place ${check.name} on this position`, ephemeral: true })

                    // temporarily place furniture (don't save yet)
                    home.D_DATA.D4 = true;
                    home.D_DATA.D4I = check.name;
                    //rebuild canvas sort 4-1
                    await replaceHouse(client, interaction, ctx, home)
                    
                    const ok = await previewAndConfirmFurniture({
                        client, interaction, msg, home, inv, check: { ...check, id },
                        positionLabel: 'D4',
                        rollback: async () => {
                            home.D_DATA.D4 = false;
                            home.D_DATA.D4I = "";
                            await home.save();
                        }
                    });
                    if (!ok) {
                        // rollback if preview failed
                        home.D_DATA.D4 = false;
                        home.D_DATA.D4I = "";
                        await replaceHouse(client, interaction, ctx, home);
                    }
                    try { await m.delete().catch(() => {}); } catch {}
                    collector.stop();
                    messageCollectorD.stop();
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