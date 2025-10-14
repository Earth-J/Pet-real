const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, ButtonStyle, ButtonBuilder } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const GInv = require("../../settings/models/inventory.js");
const GHouse = require("../../settings/models/house.js");
const { replaceHouse } = require("../../structures/replace.js");
const { RenderQueueClient } = require("../services/renderQueue");
const { isLocalServiceUrl, uploadFromUrlToInteraction } = require("../services/discordUpload");
const { buildHouseLayers } = require("../services/layout");

// Global collector registry to prevent race conditions
const activeCollectors = new Map();

// Global editing lock to prevent multiple editing sessions
const editingLocks = new Map();

// Unified furniture editing function to reduce code duplication
const editFurnitureUnified = async (client, interaction, msg, item, type, id, section) => {
    const userId = interaction.user.id;
    
    // ตรวจสอบว่าผู้ใช้กำลังแก้ไขบ้านอยู่หรือไม่
    if (editingLocks.has(userId)) {
        const lockInfo = editingLocks.get(userId);
        const timeElapsed = Date.now() - lockInfo.startTime;
        const timeRemaining = Math.max(0, lockInfo.timeout - timeElapsed);
        
        if (timeRemaining > 0) {
            await interaction.editReply({ 
                content: `⏳ คุณกำลังแก้ไขบ้านอยู่ กรุณารอให้เสร็จสิ้นหรือหมดเวลา (เหลือ ${Math.ceil(timeRemaining / 1000)} วินาที)`, 
                embeds: [], 
                components: [] 
            });
            return;
        } else {
            // ล็อคหมดเวลาแล้ว ให้ลบออก
            editingLocks.delete(userId);
        }
    }
    
    // สร้างล็อคใหม่
    editingLocks.set(userId, {
        startTime: Date.now(),
        timeout: 300000, // 5 นาที
        section: section
    });
    
    // Stop any existing collectors for this user
    const existingCollectors = activeCollectors.get(userId);
    if (existingCollectors) {
        existingCollectors.forEach(collector => {
            try {
                collector.stop('replaced');
            } catch (e) {
                console.warn('Error stopping existing collector:', e);
            }
        });
        activeCollectors.delete(userId);
    }

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    
    // ป้องกัน inv / inv.item และ id ตั้งแต่ต้น
    if (!inv || !Array.isArray(inv.item)) {
        await interaction.editReply({ content: "ไม่พบคลังไอเท็มของคุณหรือข้อมูลไม่ถูกต้อง", embeds: [], components: [] });
        return;
    }
    if (!id) {
        await interaction.editReply({ content: "ไม่พบรหัส (ID) ของเฟอร์นิเจอร์ที่ต้องการวาง", embeds: [], components: [] });
        return;
    }
    
    const canvas = Canvas.createCanvas(300, 300);
    const ctx = canvas.getContext('2d');
    
    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setTitle("📍 เลือกตำแหน่งวางเฟอร์นิเจอร์")
        .setDescription("พิมพ์ตำแหน่งที่ต้องการวาง เช่น A1, B2, C3, D4")
    
    // เรนเดอร์บ้านพร้อม overlay กริดเลือกตำแหน่ง
    try {
        let layers = buildHouseLayers(home, { selectionOverlay: true });
        
        const { getRenderQueue } = require('../services/renderQueueSingleton');
        const { fetchBuffer } = require('../services/discordUpload');
        const queue = getRenderQueue();
        const payload = {
            guild: interaction.guild.id,
            user: interaction.user.id,
            size: { width: 300, height: 300 },
            format: 'png',
            layers,
        };
        const { jobId } = await queue.enqueue(payload);
        const result = await queue.waitForResult(jobId);
        const buffer = await fetchBuffer(result.url);
        const att = new AttachmentBuilder(buffer, { name: 'house_select.png' });
        embed.setImage('attachment://house_select.png');
        await interaction.editReply({ embeds: [embed], components: [], files: [att] });
    } catch (error) {
        console.error('Failed to render house with selection overlay:', error);
        // fallback to default background
        try {
            const placer = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
            ctx.drawImage(placer, 0, 0, canvas.width, canvas.height);
            const att = new AttachmentBuilder(await canvas.encode("png"), { name: `house.png` })
            embed.setImage("attachment://house.png");
            await interaction.editReply({ embeds: [embed], components: [], files: [att] });
        } catch (fallbackError) {
            console.error('Error loading default.png:', fallbackError);
            await interaction.editReply({ embeds: [embed], components: [], files: [] });
        }
    }

    const uiFilter = (i) => i.user.id === interaction.user.id;          // สำหรับ component (ปุ่ม/เมนู)
    const textFilter = (m) => m.author && m.author.id === interaction.user.id; // สำหรับข้อความ
    
    const collector = await msg.createMessageComponentCollector({ filter: uiFilter, time: 300000 });
    const messageCollector = interaction.channel.createMessageCollector({ filter: textFilter, time: 300000 });

    // Register collectors to prevent race conditions
    activeCollectors.set(userId, [collector, messageCollector]);

    collector.on('collect', async (menu) => {
        if (menu.isButton()) {
            if (menu.customId === 'back_edit') {
                await menu.deferUpdate();
                cleanupCollectors(userId);
                const HouseEdit = require("../../commands/Pet/HouseEdit.js");
                if (typeof HouseEdit.returnToRoot === 'function') {
                    await HouseEdit.returnToRoot(client, interaction, msg);
                } else {
                    await interaction.editReply({ content: 'ไม่สามารถย้อนกลับได้ กรุณาใช้ /house edit ใหม่', embeds: [], components: [] });
                }
            } else if (menu.customId === 'close_edit') {
                await menu.deferUpdate();
                await interaction.editReply({ content: 'ปิดการแก้ไขแล้ว', embeds: [], components: [], files: [] });
                cleanupCollectors(userId);
                // ลบการล็อคเมื่อปิดการแก้ไข
                editingLocks.delete(userId);
            }
        }
    });

    messageCollector.on('collect', async (m) => {
        // Double-check this collector is still active
        if (!activeCollectors.has(userId) || !activeCollectors.get(userId).includes(messageCollector)) {
            return;
        }

        const raw = (m.content || '').trim().toUpperCase();
        const posMatch = /^(A|B|C|D)([1-4])$/.exec(raw);
        if (!posMatch) {
            const warn = await m.reply({ content: 'โปรดพิมพ์ตำแหน่งเป็นรูปแบบ A1-D4 เท่านั้น', allowedMentions: { repliedUser: false } }).catch(() => null);
            if (warn && warn.delete) { try { await warn.delete().catch(() => {}); } catch {} }
            try { await m.delete().catch(() => {}); } catch {}
            return;
        }
        const inputSection = posMatch[1];
        const number = parseInt(posMatch[2], 10);
        
        // Route to appropriate section if different
        if (inputSection !== section) {
            try { await m.delete().catch(() => {}); } catch {}
            cleanupCollectors(userId);
            if (inputSection === 'A') return editFurnitureUnified(client, interaction, msg, item, type, id, 'A');
            if (inputSection === 'B') return editFurnitureUnified(client, interaction, msg, item, type, id, 'B');
            if (inputSection === 'C') return editFurnitureUnified(client, interaction, msg, item, type, id, 'C');
            if (inputSection === 'D') return editFurnitureUnified(client, interaction, msg, item, type, id, 'D');
        }

        // Handle placement for current section
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        try {
            const place_on = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
            ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height);
        } catch (error) {
            console.error('Error loading default.png:', error);
            try { await m.delete().catch(() => {}); } catch {}
            return interaction.editReply({ content: "❌ ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง", embeds: [], components: [] });
        }

        const check = (inv.item || []).find(x => x && x.id === id);
        if (!check) {
            return interaction.editReply({ content: "ไม่พบเฟอร์นิเจอร์ในคลัง กรุณาลองใหม่อีกครั้ง", embeds: [], components: [] });
        }
        
        const slotKey = `${section}${number}`;
        // หา secondary slot สำหรับ preview (ไม่สนว่าว่างหรือไม่)
        const secondarySlot = getSecondarySlotForPreview(section, number, check?.area === 2);

        // Debug: แสดงข้อมูลการตรวจสอบ conflict
        console.log(`Debug conflict check for ${slotKey}:`, {
            section,
            number,
            slotKey,
            secondarySlot,
            area: check.area,
            furnitureName: check.name,
            currentSlotOccupied: home[`${section}_DATA`][slotKey],
            currentSlotName: home[`${section}_DATA`][`${slotKey}I`]
        });

        // Check for conflicts - ตรวจสอบ primary slot เท่านั้น (secondary slot เช็คตอน Save)
        if (home[`${section}_DATA`][slotKey] === true) {
            console.log(`Conflict detected: Primary slot ${slotKey} is occupied`);
            return sendAutoDeleteMessage(interaction, "ไม่สามารถวางเฟอร์นิเจอร์ในตำแหน่งนี้ได้ ตำแหน่งนี้ถูกใช้งานแล้ว");
        }
        
        // สำหรับเฟอร์นิเจอร์ 2x2: แจ้งเตือนว่าต้องกด Flip ถ้า secondary slot ไม่ว่าง (จะเช็คตอน Save)
        // ไม่บล็อก preview - ให้ผู้ใช้ลอง flip ดูได้

        // Check if 2x2 placement is valid for this slot
        if (check.area === 2 && !isValid2x2Placement(section, number)) {
            return sendAutoDeleteMessage(interaction, `ไม่สามารถวางเฟอร์นิเจอร์ 2x2 ในตำแหน่ง ${slotKey} ได้`);
        }

        // Place furniture temporarily
        home[`${section}_DATA`][slotKey] = true;
        home[`${section}_DATA`][`${slotKey}I`] = check.name;
        
        console.log(`Debug ${section} placement - Primary slot ${slotKey}:`, {
            slot: slotKey,
            name: check.name,
            area: check.area,
            secondarySlot: secondarySlot
        });
        
        if (check.area === 2 && secondarySlot) {
            const [secSection, secNumber] = secondarySlot.split('');
            const secSlotKey = `${secSection}${secNumber}`;
            
            // วาง "OCCUPIED" เฉพาะถ้าช่องว่าง (สำหรับ preview)
            // ถ้าช่องไม่ว่าง จะแจ้งเตือนตอน Save แทน
            const isSlotAvailable = home[`${secSection}_DATA`][secSlotKey] !== true &&
                (!home[`${secSection}_DATA`][`${secSlotKey}I`] || home[`${secSection}_DATA`][`${secSlotKey}I`] === '');
            
            if (isSlotAvailable) {
                home[`${secSection}_DATA`][secSlotKey] = true;
                home[`${secSection}_DATA`][`${secSlotKey}I`] = "OCCUPIED";
                
                console.log(`Debug ${section} placement - Secondary slot ${secSlotKey}:`, {
                    slot: secSlotKey,
                    name: "OCCUPIED",
                    section: secSection,
                    number: secNumber
                });
            } else {
                console.log(`Debug ${section} placement - Secondary slot ${secSlotKey} is occupied, will show preview anyway`);
            }
        }

        await replaceHouse(client, interaction, ctx, home);

        const ok = await previewAndConfirmFurniture({
            client, interaction, msg, home, inv, check: check,
            positionLabel: slotKey,
            rollback: async () => {
                // ล้าง primary slot
                home[`${section}_DATA`][slotKey] = false;
                home[`${section}_DATA`][`${slotKey}I`] = "";
                
                // สำหรับ 2x2 furniture: หา secondary slot ปัจจุบันจาก home object
                if (check.area === 2) {
                    // ตรวจสอบทั้งแนวนอนและแนวตั้งเพื่อหา OCCUPIED slot
                    const nextNumber = number + 1;
                    const nextSection = String.fromCharCode(section.charCodeAt(0) + 1);
                    
                    // ลองแนวนอน
                    if (nextNumber <= 4 && home[`${section}_DATA`][`${section}${nextNumber}I`] === "OCCUPIED") {
                        home[`${section}_DATA`][`${section}${nextNumber}`] = false;
                        home[`${section}_DATA`][`${section}${nextNumber}I`] = "";
                    }
                    // ลองแนวตั้ง
                    if (nextSection <= 'D' && home[`${nextSection}_DATA`] && home[`${nextSection}_DATA`][`${nextSection}${number}I`] === "OCCUPIED") {
                        home[`${nextSection}_DATA`][`${nextSection}${number}`] = false;
                        home[`${nextSection}_DATA`][`${nextSection}${number}I`] = "";
                    }
                }
                await home.save();
            }
        });

        if (!ok) {
            // rollback if preview failed
            home[`${section}_DATA`][slotKey] = false;
            home[`${section}_DATA`][`${slotKey}I`] = "";
            
            // สำหรับ 2x2 furniture: หา secondary slot ปัจจุบันจาก home object
            if (check.area === 2) {
                const nextNumber = number + 1;
                const nextSection = String.fromCharCode(section.charCodeAt(0) + 1);
                
                // ลองแนวนอน
                if (nextNumber <= 4 && home[`${section}_DATA`][`${section}${nextNumber}I`] === "OCCUPIED") {
                    home[`${section}_DATA`][`${section}${nextNumber}`] = false;
                    home[`${section}_DATA`][`${section}${nextNumber}I`] = "";
                }
                // ลองแนวตั้ง
                if (nextSection <= 'D' && home[`${nextSection}_DATA`] && home[`${nextSection}_DATA`][`${nextSection}${number}I`] === "OCCUPIED") {
                    home[`${nextSection}_DATA`][`${nextSection}${number}`] = false;
                    home[`${nextSection}_DATA`][`${nextSection}${number}I`] = "";
                }
            }
            await replaceHouse(client, interaction, ctx, home);
        }

        try { await m.delete().catch(() => {}); } catch {}
        cleanupCollectors(userId);
        // ลบการล็อคเมื่อเสร็จสิ้นการวางเฟอร์นิเจอร์
        editingLocks.delete(userId);
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            const timed = new EmbedBuilder()
                .setDescription(`หมดเวลา!`)
                .setColor(client.color)
            interaction.editReply({ embeds: [timed], components: [], files: [] });
        }
        cleanupCollectors(userId);
        // ลบการล็อคเมื่อหมดเวลา
        editingLocks.delete(userId);
    });

    messageCollector.on('end', () => {
        cleanupCollectors(userId);
        // ลบการล็อคเมื่อ message collector หมดเวลา
        editingLocks.delete(userId);
    });
};

// Helper function to clean up collectors
const cleanupCollectors = (userId) => {
    const collectors = activeCollectors.get(userId);
    if (collectors) {
        collectors.forEach(collector => {
            try {
                collector.stop('cleanup');
            } catch (e) {
                console.warn('Error stopping collector during cleanup:', e);
            }
        });
        activeCollectors.delete(userId);
    }
};

// Helper function to send auto-deleting error message
const sendAutoDeleteMessage = async (interaction, content, deleteAfter = 2000) => {
    const message = await interaction.followUp({ content, ephemeral: true });
    setTimeout(() => {
        try {
            message.delete().catch(() => {});
        } catch (e) {
            // Ignore deletion errors
        }
    }, deleteAfter);
    return message;
};

// Helper functions
// ฟังก์ชันหา secondary slot สำหรับ preview (ไม่เช็คว่าว่างหรือไม่)
const getSecondarySlotForPreview = (section, number, is2x2) => {
    if (!is2x2) return null;
    
    // Section D: วางแนวตั้งเสมอ (D1-D2, D2-D3, D3-D4)
    if (section === 'D') {
        const nextNumber = number + 1;
        return nextNumber <= 4 ? `D${nextNumber}` : null;
    }
    
    // Section A, B, C: วางแนวนอน default (A1-A2, B1-B2, C1-C2)
    const nextNumber = number + 1;
    if (nextNumber <= 4) {
        return `${section}${nextNumber}`;
    }
    
    // Column 4 (A4, B4, C4): ต้องกด Flip เป็นแนวตั้งก่อน
    return null;
};

const isValid2x2Placement = (section, number) => {
    // ทุกแถววางได้ทั้งแนวนอนและแนวตั้ง
    // แนวนอน: ต้องไม่เป็น column 4 (เพราะไม่มี column 5)
    // แนวตั้ง: ต้องไม่เป็นแถว D (เพราะไม่มีแถว E)
    
    // สามารถวางได้ถ้า:
    // 1. ไม่ใช่ D4 (เพราะไม่สามารถวางทั้งแนวนอนและแนวตั้งได้)
    if (section === 'D' && number === 4) return false;
    
    // 2. ทุกตำแหน่งอื่น�างได้ (อย่างน้อยทิศทางใดทิศทางหนึ่ง)
    return true;
};

// Preview and confirm function with flip support
async function previewAndConfirmFurniture({ client, interaction, msg, home, inv, check, positionLabel, rollback }) {
    // Debug: ตรวจสอบข้อมูลที่ส่งมา
    console.log('previewAndConfirmFurniture - check:', check);
    console.log('previewAndConfirmFurniture - positionLabel:', positionLabel);
    
    if (!check) {
        console.error('previewAndConfirmFurniture - check is undefined!');
        return false;
    }
    
    const queue = new RenderQueueClient({
        baseUrl: process.env.RENDER_SERVICE_URL || "http://localhost:8081",
        apiKey: process.env.RENDER_SERVICE_KEY || undefined,
        pollIntervalMs: 1500,
        timeoutMs: 45000,
    });
    
    // ตรวจสอบทิศทางเริ่มต้นจาก home object
    const section = positionLabel.charAt(0);
    const number = parseInt(positionLabel.charAt(1));
    let initialDirection = 'horizontal'; // default
    
    // สำหรับ 2x2 furniture: ตรวจสอบว่าถูกวางแนวไหน
    if (check.area === 2) {
        const nextNumber = number + 1;
        const nextSection = String.fromCharCode(section.charCodeAt(0) + 1);
        
        const isHorizontal = nextNumber <= 4 && 
            home[`${section}_DATA`]?.[`${section}${nextNumber}`] === true &&
            home[`${section}_DATA`]?.[`${section}${nextNumber}I`] === "OCCUPIED";
        
        const isVertical = nextSection <= 'D' &&
            home[`${nextSection}_DATA`]?.[`${nextSection}${number}`] === true &&
            home[`${nextSection}_DATA`]?.[`${nextSection}${number}I`] === "OCCUPIED";
        
        // ถ้าไม่เจอ OCCUPIED ทั้งสองทิศทาง → ใช้ default จาก secondary slot
        if (isHorizontal) {
            initialDirection = 'horizontal';
        } else if (isVertical) {
            initialDirection = 'vertical';
        } else {
            // ใช้ default จาก getSecondarySlotForPreview
            // Section A, B, C = horizontal, Section D = vertical
            initialDirection = (section === 'D') ? 'vertical' : 'horizontal';
        }
        
        console.log(`📍 Initial placement direction for ${positionLabel}:`, {
            direction: initialDirection,
            horizontal: isHorizontal ? `${section}${number}-${section}${nextNumber}` : 'no',
            vertical: isVertical ? `${section}${number}-${nextSection}${number}` : 'no',
            reason: (!isHorizontal && !isVertical) ? 'using default' : 'detected from OCCUPIED'
        });
    }
    
    let flipCount = 0; // นับจำนวนครั้งที่กด flip
    
    try {
        await interaction.editReply({ content: `🧩 วางเฟอร์นิเจอร์ที่ ${positionLabel} แล้ว กำลังเรนเดอร์ Preview...`, embeds: [], components: [] });
        
        // ฟังก์ชันสำหรับเรนเดอร์ preview
        const renderPreview = async () => {
            // ใช้ home object โดยตรง (มีชื่อเฟอร์นิเจอร์ที่ถูกต้องแล้ว รวม flip state)
            const payload = {
                guild: interaction.guild.id,
                user: interaction.user.id,
                size: { width: 300, height: 300 },
                format: 'png',
                layers: buildHouseLayers(home),
                debug: { 
                    checkName: check?.name || 'unknown', 
                    flipCount, 
                    initialDirection,
                    currentSlotName: home?.[`${positionLabel.charAt(0)}_DATA`]?.[`${positionLabel}I`] || 'unknown' 
                }
            };
            
            const section = positionLabel.charAt(0);
            const slotKey = `${section}${positionLabel.charAt(1)}`;
            console.log('Rendering furniture:', {
                slot: slotKey,
                name: home?.[`${section}_DATA`]?.[`${slotKey}I`],
                flipCount,
                initialDirection
            });
            
            const { jobId } = await queue.enqueue(payload);
            try {
                return await queue.waitForResult(jobId);
            } catch (renderError) {
                console.error('Render service error:', renderError);
                throw new Error('ไม่สามารถเรนเดอร์ภาพได้ กรุณาลองใหม่อีกครั้ง');
            }
        };
        
        const result = await renderPreview();

        // สร้างปุ่มตามประเภทของเฟอร์นิเจอร์และตำแหน่ง
        const section = positionLabel.charAt(0); // A, B, C, D
        const isD2x2 = section === 'D' && check.area === 2;
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('preview_save_fur').setLabel('บันทึก').setStyle(ButtonStyle.Success),
            // สำหรับ slot D เฟอร์นิเจอร์ 2x2 แนวตั้งไม่ต้อง flip
            ...(isD2x2 ? [] : [new ButtonBuilder().setCustomId('preview_flip_fur').setLabel('🔄 พลิก').setStyle(ButtonStyle.Primary)]),
            new ButtonBuilder().setCustomId('preview_back_fur').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('preview_cancel_fur').setLabel('ยกเลิก').setStyle(ButtonStyle.Danger)
        );
        const { fetchBuffer } = require('../services/discordUpload');
        const buf = await fetchBuffer(result.url);
        const att = new AttachmentBuilder(buf, { name: 'preview.png' });
        const embedPrev = new EmbedBuilder().setTitle('ตัวอย่างบ้านของคุณ').setImage('attachment://preview.png').setColor(client.color);
        await interaction.editReply({ content: " ", embeds: [embedPrev], components: [row], files: [att] });

        const previewFilter = (i) => i.user.id === interaction.user.id;
        const collector = await msg.createMessageComponentCollector({ filter: previewFilter, time: 300000 });
        let closed = false; // guard to prevent any action after cancel/back
        collector.on('collect', async (i) => {
            if (closed) { try { await i.deferUpdate(); } catch {} return; }
            await i.deferUpdate();
            if (i.customId === 'preview_save_fur') {
                // ตรวจสอบการบันทึกเฟอร์นิเจอร์ตามตำแหน่งและทิศทาง
                const section = positionLabel.charAt(0); // A, B, C, D
                const number = parseInt(positionLabel.charAt(1)); // 1, 2, 3, 4
                const currentName = check.name || '';
                
                // เฟอร์นิเจอร์ 1x1 สามารถบันทึกได้ทุกช่อง ไม่มีการจำกัดทิศทาง
                if (check.area === 1) {
                    // ไม่ต้องตรวจสอบอะไร เฟอร์นิเจอร์ 1x1 บันทึกได้ทุกช่อง
                } else {
                    // สำหรับเฟอร์นิเจอร์ 2x2: ตรวจสอบว่า secondary slot ว่างหรือไม่
                    const nextNumber = number + 1;
                    const nextSection = String.fromCharCode(section.charCodeAt(0) + 1);
                    
                    // ตรวจสอบทิศทางปัจจุบันจาก home object
                    const isHorizontal = nextNumber <= 4 && 
                        home[`${section}_DATA`]?.[`${section}${nextNumber}`] === true &&
                        home[`${section}_DATA`]?.[`${section}${nextNumber}I`] === "OCCUPIED";
                    
                    const isVertical = nextSection <= 'D' &&
                        home[`${nextSection}_DATA`]?.[`${nextSection}${number}`] === true &&
                        home[`${nextSection}_DATA`]?.[`${nextSection}${number}I`] === "OCCUPIED";
                    
                    // ตรวจสอบว่ามีทิศทางที่ถูกต้อง
                    if (!isHorizontal && !isVertical) {
                        // ไม่มีการวางเฟอร์นิเจอร์ 2x2 ในทิศทางใด
                        let suggestedDirection = '';
                        if (section === 'D') {
                            suggestedDirection = nextNumber <= 4 ? `${positionLabel}-D${nextNumber}` : 'ไม่สามารถวางได้';
                        } else if (number === 4) {
                            suggestedDirection = `${positionLabel}-${nextSection}${number} (กด Flip)`;
                        } else {
                            suggestedDirection = `${positionLabel}-${section}${nextNumber}`;
                        }
                        
                        await sendAutoDeleteMessage(interaction, `❌ ไม่สามารถบันทึกได้ ตำแหน่ง ${suggestedDirection} ไม่ว่าง\nกด Flip เพื่อเปลี่ยนทิศทาง หรือกด Cancel`);
                        return;
                    }
                    
                    // ตรวจสอบ A4, B4, C4 - ต้องวางแนวตั้งเท่านั้น (ไม่มี column 5)
                    if ((section === 'A' || section === 'B' || section === 'C') && number === 4) {
                        if (check.area === 2 && !isVertical) {
                            await sendAutoDeleteMessage(interaction, `❌ ไม่สามารถบันทึกเฟอร์นิเจอร์ 2x2 แนวนอนในตำแหน่ง ${positionLabel} ได้ (ต้องเป็นแนวตั้ง)`);
                            return;
                        }
                        if (currentName.includes('_left')) {
                            await sendAutoDeleteMessage(interaction, `❌ ไม่สามารถบันทึกเฟอร์นิเจอร์ทิศทางซ้ายในตำแหน่ง ${positionLabel} ได้`);
                            return;
                        }
                    }
                }
                
                // ถ้าผ่านการตรวจสอบแล้ว ถึงจะตั้ง closed = true
                closed = true;
                
                // ชื่อเฟอร์นิเจอร์ถูกอัปเดตใน home object แล้วตอน flip
                // ไม่ต้องทำอะไรเพิ่มที่นี่
                
                // commit: remove item from inv, save URL
                const itemIndex = inv.item.findIndex(x => x && x.id === check?.id);
                if (itemIndex !== -1) {
                    inv.item.splice(itemIndex, 1);
                }
                await inv.save();
                
                // เรนเดอร์ครั้งสุดท้ายด้วยสถานะ flip ปัจจุบัน
                const finalResult = await renderPreview();
                let finalUrl = finalResult.url;
                if (isLocalServiceUrl(finalUrl, process.env.RENDER_SERVICE_URL)) {
                    const uploaded = await uploadFromUrlToInteraction(interaction, finalUrl, `house.${finalResult.format === 'gif' ? 'gif' : 'png'}`);
                    if (uploaded) finalUrl = uploaded;
                }
                home.house = finalUrl;
                await home.save();
                const savedEmbed = new EmbedBuilder().setColor(client.color).setDescription('บันทึกบ้านเรียบร้อยแล้ว');
                await interaction.editReply({ embeds: [savedEmbed], components: [], files: [] });
                collector.stop();
                // ลบการล็อคเมื่อบันทึกเสร็จสิ้น
                editingLocks.delete(interaction.user.id);
            } else if (i.customId === 'preview_flip_fur') {
                // เปลี่ยนสถานะ flip และสลับทิศทางการวางเฟอร์นิเจอร์ 2x2
                flipCount++;
                await interaction.editReply({ content: `🔄 กำลังพลิกเฟอร์นิเจอร์...`, embeds: [], components: [] });
                
                try {
                    const section = positionLabel.charAt(0);
                    const number = parseInt(positionLabel.charAt(1));
                    const slotKey = `${section}${number}`;
                    const currentName = home[`${section}_DATA`][`${slotKey}I`];
                    
                    if (!currentName || currentName === "OCCUPIED") {
                        throw new Error('Invalid slot data');
                    }
                    
                    // สำหรับเฟอร์นิเจอร์ 2x2: สลับทิศทาง
                    if (check.area === 2) {
                        // หา secondary slot ปัจจุบันและใหม่
                        let currentSecondarySlot = null;
                        let newSecondarySlot = null;
                        
                        const nextNumber = number + 1;
                        const nextSection = String.fromCharCode(section.charCodeAt(0) + 1);
                        
                        // ตรวจสอบทิศทางปัจจุบันจาก home object (เช็คทั้งที่มี OCCUPIED และไม่มี)
                        const hasHorizontalOccupied = nextNumber <= 4 && 
                            home[`${section}_DATA`][`${section}${nextNumber}`] === true &&
                            home[`${section}_DATA`][`${section}${nextNumber}I`] === "OCCUPIED";
                        
                        const hasVerticalOccupied = nextSection <= 'D' &&
                            home[`${nextSection}_DATA`]?.[`${nextSection}${number}`] === true &&
                            home[`${nextSection}_DATA`]?.[`${nextSection}${number}I`] === "OCCUPIED";
                        
                        // กำหนดทิศทางปัจจุบัน (ถ้าไม่มี OCCUPIED ใช้ initialDirection)
                        let isCurrentlyHorizontal;
                        if (hasHorizontalOccupied) {
                            isCurrentlyHorizontal = true;
                        } else if (hasVerticalOccupied) {
                            isCurrentlyHorizontal = false;
                        } else {
                            // ไม่มี OCCUPIED ในทั้งสองทิศทาง → ใช้ initialDirection
                            isCurrentlyHorizontal = (initialDirection === 'horizontal');
                        }
                        
                        if (isCurrentlyHorizontal) {
                            // ปัจจุบันแนวนอน → เปลี่ยนเป็นแนวตั้ง
                            currentSecondarySlot = `${section}${nextNumber}`;
                            newSecondarySlot = `${nextSection}${number}`;
                        } else {
                            // ปัจจุบันแนวตั้ง → เปลี่ยนเป็นแนวนอน
                            currentSecondarySlot = `${nextSection}${number}`;
                            newSecondarySlot = `${section}${nextNumber}`;
                        }
                        
                        // ตรวจสอบว่า slot ใหม่ว่างหรือไม่
                        const [newSecSection, newSecNumber] = [newSecondarySlot.charAt(0), parseInt(newSecondarySlot.charAt(1))];
                        
                        if (newSecSection > 'D' || newSecNumber > 4) {
                            await sendAutoDeleteMessage(interaction, `❌ ไม่สามารถพลิกเฟอร์นิเจอร์ในทิศทางนี้ได้ (slot ${newSecondarySlot} ไม่มี)`);
                            return;
                        }
                        
                        if (!home[`${newSecSection}_DATA`]) {
                            await sendAutoDeleteMessage(interaction, `❌ ไม่สามารถพลิกเฟอร์นิเจอร์ในทิศทางนี้ได้`);
                            return;
                        }
                        
                        if (home[`${newSecSection}_DATA`][newSecondarySlot] === true) {
                            await sendAutoDeleteMessage(interaction, `❌ ไม่สามารถพลิกได้ ตำแหน่ง ${newSecondarySlot} ถูกใช้งานแล้ว`);
                            return;
                        }
                        
                        // ล้าง secondary slot เดิม (เฉพาะถ้ามี "OCCUPIED" ของเราเท่านั้น)
                        const [oldSecSection, oldSecNumber] = [currentSecondarySlot.charAt(0), parseInt(currentSecondarySlot.charAt(1))];
                        const oldSlotValue = home[`${oldSecSection}_DATA`]?.[`${currentSecondarySlot}I`];
                        
                        if (oldSlotValue === "OCCUPIED") {
                            // ล้างเฉพาะถ้ามี OCCUPIED ของเรา (ไม่ใช่เฟอร์นิเจอร์ของคนอื่น)
                            home[`${oldSecSection}_DATA`][currentSecondarySlot] = false;
                            home[`${oldSecSection}_DATA`][`${currentSecondarySlot}I`] = "";
                            console.log(`🧹 Cleared old OCCUPIED at ${currentSecondarySlot}`);
                        } else {
                            console.log(`⚠️ Skipped clearing ${currentSecondarySlot} (not OCCUPIED, has: ${oldSlotValue})`);
                        }
                        
                        // ตั้งค่า secondary slot ใหม่
                        home[`${newSecSection}_DATA`][newSecondarySlot] = true;
                        home[`${newSecSection}_DATA`][`${newSecondarySlot}I`] = "OCCUPIED";
                        
                        // เปลี่ยนชื่อไฟล์ของเฟอร์นิเจอร์ 2x2 ตามทิศทาง
                        let newFurnitureName = currentName;
                        
                        if (isCurrentlyHorizontal) {
                            // เปลี่ยนจากแนวนอน → แนวตั้ง
                            // รองรับ: _horizontal → _vertical, _h → _v, _left → _right, _right → _left
                            if (currentName.includes('_horizontal')) {
                                newFurnitureName = currentName.replace('_horizontal', '_vertical');
                            } else if (currentName.includes('_h')) {
                                newFurnitureName = currentName.replace('_h', '_v');
                            } else if (currentName.endsWith('_left')) {
                                newFurnitureName = currentName.replace('_left', '_right');
                            } else if (currentName.endsWith('_right')) {
                                newFurnitureName = currentName.replace('_right', '_left');
                            } else {
                                // ถ้าไม่มี suffix → เพิ่ม _right (เพื่อให้ render service ใช้ fallback)
                                newFurnitureName = currentName + '_right';
                            }
                        } else {
                            // เปลี่ยนจากแนวตั้ง → แนวนอน
                            if (currentName.includes('_vertical')) {
                                newFurnitureName = currentName.replace('_vertical', '_horizontal');
                            } else if (currentName.includes('_v')) {
                                newFurnitureName = currentName.replace('_v', '_h');
                            } else if (currentName.endsWith('_right')) {
                                newFurnitureName = currentName.replace('_right', '_left');
                            } else if (currentName.endsWith('_left')) {
                                newFurnitureName = currentName.replace('_left', '_right');
                            } else {
                                // ถ้าไม่มี suffix → เพิ่ม _left
                                newFurnitureName = currentName + '_left';
                            }
                        }
                        
                        // อัปเดตชื่อใน home object
                        home[`${section}_DATA`][`${slotKey}I`] = newFurnitureName;
                        
                        console.log(`🔄 Flipped 2x2 furniture direction: ${slotKey}-${currentSecondarySlot} → ${slotKey}-${newSecondarySlot}`);
                        console.log(`🎨 Changed furniture name: ${currentName} → ${newFurnitureName}`);
                    } else {
                        // สำหรับเฟอร์นิเจอร์ 1x1: สลับชื่อไฟล์ (_left ↔ _right)
                        const newName = currentName.endsWith('_left') 
                            ? currentName.replace('_left', '_right')
                            : currentName.endsWith('_right')
                            ? currentName.replace('_right', '_left')
                            : currentName + '_right';
                        
                        home[`${section}_DATA`][`${slotKey}I`] = newName;
                        console.log(`🔄 Flipped 1x1 furniture: ${currentName} → ${newName}`);
                    }
                    
                    const newResult = await renderPreview();
                    const { fetchBuffer } = require('../services/discordUpload');
                    const buf = await fetchBuffer(newResult.url);
                    const att = new AttachmentBuilder(buf, { name: 'preview.png' });
                    const embedPrev = new EmbedBuilder()
                        .setTitle('ตัวอย่างบ้าน')
                        .setImage('attachment://preview.png')
                        .setColor(client.color)
                        .setDescription(flipCount > 0 ? `เฟอร์นิเจอร์ถูกพลิก (${flipCount} ครั้ง)` : 'ตัวอย่างบ้าน');
                    
                    await interaction.editReply({ content: " ", embeds: [embedPrev], components: [row], files: [att] });
                } catch (error) {
                    console.error('Error flipping furniture:', error);
                    await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการพลิกเฟอร์นิเจอร์', embeds: [], components: [] });
                }
            } else if (i.customId === 'preview_back_fur') {
                closed = true;
                // stop preview collector first to avoid races
                collector.stop();
                
                // อ่านชื่อปัจจุบันจาก home object ก่อน rollback
                const sectionForBack = positionLabel.charAt(0);
                const numberForBack = parseInt(positionLabel.charAt(1));
                const slotKeyForBack = `${sectionForBack}${numberForBack}`;
                let itemName = home[`${sectionForBack}_DATA`][`${slotKeyForBack}I`];
                
                // rollback and return to slot selection for the same item
                if (rollback) await rollback();
                const section = String(positionLabel || '').charAt(0).toUpperCase();
                
                // ใช้ชื่อที่อ่านได้จาก home object (รวม flip state)
                const itemType = check && check.type ? check.type : undefined;
                const itemId = check && check.id ? check.id : undefined;
                
                // Clear preview UI first with a minimal embed to avoid Discord 50006
                const placeholder = new EmbedBuilder().setDescription('กำลังย้อนกลับ...').setColor(client.color);
                await interaction.editReply({ embeds: [placeholder], components: [], files: [] });
                // ไม่ล้างทั้งหมดเพื่อไม่กระทบของที่ Save ไปแล้ว (rollback ดูแลเฉพาะวางล่าสุด)
                // yield to event loop to ensure new collectors can attach before user types
                await new Promise(r => setTimeout(r, 25));
                return editFurnitureUnified(client, interaction, msg, itemName, itemType, itemId, section);
            } else if (i.customId === 'preview_cancel_fur') {
                closed = true;
                // rollback state
                if (rollback) await rollback();
                const cancelEmbed = new EmbedBuilder().setColor(client.color).setDescription('ยกเลิกแล้ว');
                await interaction.editReply({ embeds: [cancelEmbed], components: [], files: [] });
                collector.stop();
                // ลบการล็อคเมื่อยกเลิก
                editingLocks.delete(interaction.user.id);
            }
        });
        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                closed = true;
                if (rollback) await rollback();
                const timeoutEmbed = new EmbedBuilder().setColor(client.color).setDescription('หมดเวลา ยกเลิกการแก้ไข');
                await interaction.editReply({ embeds: [timeoutEmbed], components: [], files: [] });
            }
            // ลบการล็อคเมื่อหมดเวลาใน preview
            editingLocks.delete(interaction.user.id);
        });
        return true;
    } catch (e) {
        console.error('Error in previewAndConfirmFurniture:', e);
        if (rollback) await rollback();
        // ลบการล็อคเมื่อเกิด error
        editingLocks.delete(interaction.user.id);
        return false; // ให้ fallback PNG เดิม
    }
}

// Helper function to check editing status
const getEditingStatus = (userId) => {
    if (!editingLocks.has(userId)) {
        return { isEditing: false };
    }
    
    const lockInfo = editingLocks.get(userId);
    const timeElapsed = Date.now() - lockInfo.startTime;
    const timeRemaining = Math.max(0, lockInfo.timeout - timeElapsed);
    
    return {
        isEditing: timeRemaining > 0,
        timeRemaining: timeRemaining,
        section: lockInfo.section,
        startTime: lockInfo.startTime
    };
};

// Helper function to force unlock (for admin purposes)
const forceUnlock = (userId) => {
    editingLocks.delete(userId);
    cleanupCollectors(userId);
};

module.exports = { editFurnitureUnified, getEditingStatus, forceUnlock };
