const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require("discord.js");
const { selectFurniture } = require("../../structures/select/furniture.js");
const { selectFloor } = require("../../structures/select/floor.js");
const { selectTile } = require("../../structures/select/tile.js");
const Canvas = require("@napi-rs/canvas");
const GHome = require("../../settings/models/house.js");
const GInv = require("../../settings/models/inventory.js");
const { imageCache } = require("../../structures/utils/imageCache.js");
const { getRenderQueue } = require("../../structures/services/renderQueueSingleton");
const { fetchBuffer } = require("../../structures/services/discordUpload");
const { buildHouseLayers } = require("../../structures/services/layout");
const { stableHash } = require("../../structures/utils/hash");
const mongoose = require("mongoose");
const { withLock } = require("../../structures/utils/locks");
const { shouldThrottle } = require("../../structures/utils/throttle");
const { getEditingStatus, forceUnlock } = require("../../structures/edit/furnitureUnified.js");
const { buildRemoveOptions, removeFurnitureSlot, returnItemToInventory, findItemDefByName } = require("../../structures/edit/removeFurniture.js");
// removed local fs/path usage to enforce CDN-only image loading

// removed local image loader; we use CDN-only via imageCache.getImage



async function removeFloor(home, inv) {
    const name = home.FLOOR_DATA?.FLOORI;
    if (!name) return false;
    await returnItemToInventory(inv, name, 'floor');
    home.FLOOR_DATA.FLOOR = false;
    home.FLOOR_DATA.FLOORI = "";
    return true;
}

async function removeTile(home, inv) {
    const name = home.TILE_DATA?.TILEI;
    if (!name) return false;
    await returnItemToInventory(inv, name, 'tile');
    home.TILE_DATA.TILE = false;
    home.TILE_DATA.TILEI = "";
    return true;
}

module.exports = {
    name: ["เเก้ไขบ้าน"],
    description: "แก้ไขบ้านของฉัน",
    category: "House",
    run: async (client, interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // ตรวจสอบว่าผู้ใช้กำลังแก้ไขบ้านอยู่หรือไม่
        const userId = interaction.user.id;
        const editingStatus = getEditingStatus(userId);
        
        if (editingStatus.isEditing) {
            const timeRemaining = Math.ceil(editingStatus.timeRemaining / 1000);
            const minutes = Math.floor(timeRemaining / 60);
            
            const waitEmbed = new EmbedBuilder()
                .setTitle('⏳ กำลังแก้ไขบ้านอยู่')
                .setDescription(`คุณกำลังแก้ไข **${editingStatus.section}** อยู่\nกรุณารอให้เสร็จสิ้นหรือหมดเวลา`)
                .addFields({ name: '⏰ เวลาที่เหลือ', value: `${minutes}:${seconds.toString().padStart(2, '0')} นาที`, inline: true })
                .setColor('#FFDFBA')
                .setTimestamp(Date.now() + editingStatus.timeRemaining);
            
            await interaction.editReply({ 
                content: '', 
                embeds: [waitEmbed], 
                components: [] 
            });
            return;
        }

        const loadEmbed = new EmbedBuilder()
            .setDescription('🔄 **กำลังโหลด...** โปรดรอสักครู่')
            .setColor('#BAE1FF');
        const msg = await interaction.editReply({ embeds: [loadEmbed], components: [] });

        try {
            const canvas = Canvas.createCanvas(300, 300);
            const ctx = canvas.getContext("2d");

            const home = await GHome.findOne({ guild: interaction.guild.id, user: interaction.user.id });

            let homeedit;
            try {
                homeedit = await imageCache.getImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/modify.png");
            } catch (remoteError) {
                console.error('[HouseEdit] ไม่สามารถโหลด modify.png:', remoteError);
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ เกิดข้อผิดพลาด')
                    .setDescription('ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง')
                    .setColor('#FFB3BA');
                return interaction.editReply({ content: '', embeds: [errorEmbed], components: [] });
            }
            
            if (homeedit) {
                ctx.drawImage(homeedit, 0, 0, canvas.width, canvas.height);
            } else {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ เกิดข้อผิดพลาด')
                    .setDescription('ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง')
                    .setColor('#FFB3BA');
                return interaction.editReply({ content: '', embeds: [errorEmbed], components: [] });
            }

            const homeatt = new AttachmentBuilder(await canvas.encode("png"), { name: "modify.png" });

            const embed = new EmbedBuilder()
                .setAuthor({ name: `🏠 แก้ไขบ้านสัตว์เลี้ยง`, iconURL: `https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/734801251501604995.webp` })
                .setDescription('**เลือกเมนูที่ต้องการแก้ไข**')
                .addFields(
                    { name: "🪑 เฟอร์นิเจอร์", value: "จัดวางและตกแต่งเฟอร์นิเจอร์ในบ้าน", inline: false },
                    { name: "🧱 กระเบื้อง", value: "เปลี่ยนกระเบื้องให้สวยงาม", inline: false },
                    { name: "🏠 วอลเปเปอร์", value: "เปลี่ยนวอลเปเปอร์ตกแต่งบ้าน", inline: false },
                    { name: "🗑️ ถอดเฟอร์นิเจอร์", value: "ถอดเฟอร์นิเจอร์ออกจากบ้าน", inline: false }
                )
                .setImage("attachment://modify.png")
                .setFooter({ text: '💡 เลือกจากเมนูด้านล่างเพื่อเริ่มแก้ไข' })
                .setColor(client.color);

            const select = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("house")
                        .setPlaceholder("เลือกเมนู")
                        .setMaxValues(1)
                        .setMinValues(1)
                        .setOptions([
                            { label: "1️⃣ เฟอร์นิเจอร์", description: "แก้ไขเฟอร์นิเจอร์", value: "fur" },
                            { label: "2️⃣ กระเบื้อง", description: "แก้ไขกระเบื้อง", value: "floor" },
                            { label: "3️⃣ วอลเปเปอร์", description: "แก้ไขวอลเปเปอร์", value: "tile" },
                            { label: "4️⃣ ถอดเฟอร์นิเจอร์", description: "ถอดเฟอร์นิเจอร์", value: "remove" },
                        ]),
                );

            const navButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('back_edit').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('close_edit').setLabel('ปิด').setStyle(ButtonStyle.Danger)
            );
            const navButtonsActive = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('back_edit').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('close_edit').setLabel('ปิด').setStyle(ButtonStyle.Danger)
            );

            await interaction.editReply({ content: '', embeds: [embed], components: [select, navButtons], files: [homeatt] });

            let filter = (m) => m.user.id === interaction.user.id;
            let collector = await msg.createMessageComponentCollector({ filter, time: 180000 });

            collector.on('collect', async (menu) => {
                if(menu.isStringSelectMenu()) {
                    if(menu.customId === "house") {
                        await menu.deferUpdate();
                        let [directory] = menu.values;

                        if (directory === "fur") {
                            selectFurniture(client, interaction, msg);
                            collector.stop();
                        } else if (directory === "floor") {
                            selectFloor(client, interaction, msg);
                            collector.stop();
                        } else if (directory === "tile") {
                            selectTile(client, interaction, msg);
                            collector.stop();
                        } else if (directory === "remove") {
                            const homeCurrent = await GHome.findOne({ guild: interaction.guild.id, user: interaction.user.id }).lean();
                            const options = buildRemoveOptions(homeCurrent);
                            
                            if (options.length === 0) {
                                const noItemEmbed = new EmbedBuilder()
                                    .setTitle('📭 ไม่มีเฟอร์นิเจอร์')
                                    .setDescription('ไม่มีเฟอร์นิเจอร์ให้ถอดในบ้านของคุณ')
                                    .setColor('#E0E0E0');
                                await interaction.editReply({ 
                                    content: '', 
                                    embeds: [noItemEmbed], 
                                    components: [navButtonsActive], 
                                    files: [] 
                                });
                                return;
                            }
                            const selectRemove = new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId('remove_select')
                                    .setPlaceholder('เลือกตำแหน่งที่จะถอด')
                                    .setMaxValues(1)
                                    .setMinValues(1)
                                    .setOptions(options)
                            );
                            let embedsToShow = [];
                            let filesToAttach = [];
                            try {
                                if (homeCurrent.house) {
                                    const buf = await fetchBuffer(homeCurrent.house);
                                    const att = new AttachmentBuilder(buf, { name: 'house.png' });
                                    const houseEmbed = new EmbedBuilder()
                                        .setTitle('🏠 บ้านของคุณ')
                                        .setDescription('เลือกตำแหน่งที่ต้องการถอดเฟอร์นิเจอร์')
                                        .setImage('attachment://house.png')
                                        .setColor(client.color);
                                    embedsToShow = [houseEmbed];
                                    filesToAttach = [att];
                                } else {
                                    const queue = getRenderQueue();
                                    const payload = {
                                        guild: interaction.guild.id,
                                        user: interaction.user.id,
                                        size: { width: 300, height: 300 },
                                        format: 'png',
                                        layers: buildHouseLayers(homeCurrent),
                                    };
                                    const { jobId } = await queue.enqueue(payload);
                                    const result = await queue.waitForResult(jobId);
                                    const buf = await fetchBuffer(result.url);
                                    const att = new AttachmentBuilder(buf, { name: 'house.png' });
                                    const houseEmbed = new EmbedBuilder()
                                        .setTitle('🏠 บ้านของคุณ')
                                        .setDescription('เลือกตำแหน่งที่ต้องการถอดเฟอร์นิเจอร์')
                                        .setImage('attachment://house.png')
                                        .setColor(client.color);
                                    embedsToShow = [houseEmbed];
                                    filesToAttach = [att];
                                }
                            } catch (e) {
                                embedsToShow = [embed];
                                filesToAttach = [homeatt];
                            }
                            await interaction.editReply({ content: '', embeds: embedsToShow, components: [selectRemove, navButtonsActive], files: filesToAttach });
                        }
                    } else if (menu.customId === 'remove_select') {
                        await menu.deferUpdate();
                        const [value] = menu.values;
                        // per-user lock + throttle เพื่อกัน spam/ race conditions
                        const lockKey = `house-edit:${interaction.guild.id}:${interaction.user.id}`;
                        if (shouldThrottle(lockKey, parseInt(process.env.HOUSE_EDIT_THROTTLE_MS || '2000'))) {
                            const throttleEmbed = new EmbedBuilder()
                                .setDescription('⏳ **กรุณารอสักครู่** ก่อนดำเนินการอีกครั้ง')
                                .setColor('#FFDFBA');
                            return menu.followUp({ embeds: [throttleEmbed], flags: MessageFlags.Ephemeral });
                        }
                        await withLock(lockKey, async () => {
                            const session = await mongoose.startSession();
                            session.startTransaction();
                            try {
                                const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id }).session(session);
                                const homeNow = await GHome.findOne({ guild: interaction.guild.id, user: interaction.user.id }).session(session);
                                let removedCount = 0;
                                if (value.startsWith('rm:')) {
                                    const pos = value.split(':')[1];
                                    const row = pos[0];
                                    const col = parseInt(pos[1]);
                                    // buildRemoveOptions กรองเฉพาะ furniture ไว้แล้ว ไม่ต้องเช็คอีกครั้ง
                                    if (await removeFurnitureSlot(homeNow, inv, row, col)) removedCount++;
                                }
                                await inv.save({ session });
                                await homeNow.save({ session });
                                await session.commitTransaction();

                                // เริ่มเรนเดอร์แบบ background + houseHash update แบบ dedup
                                (async () => {
                                    try {
                                        const queue = getRenderQueue();
                                        const plainHome = homeNow.toObject ? homeNow.toObject() : homeNow;
                                        const layers = buildHouseLayers(plainHome);
                                        const newHash = stableHash(layers);
                                        // ถ้า hash เดิมเหมือนเดิมและมีรูปแล้ว ข้ามการ render
                                        if (plainHome.house && plainHome.houseHash && plainHome.houseHash === newHash) return;
                                        const { jobId } = await queue.enqueue({
                                            guild: interaction.guild.id,
                                            user: interaction.user.id,
                                            size: { width: 300, height: 300 },
                                            format: 'png',
                                            layers,
                                        });
                                        const result = await queue.waitForResult(jobId);
                                        await GHome.updateOne(
                                            { guild: interaction.guild.id, user: interaction.user.id },
                                            { $set: { house: result.url, houseHash: newHash } }
                                        );
                                    } catch (_) { /* ignore */ }
                                })();

                                const resultEmbed = new EmbedBuilder()
                                    .setTitle(removedCount > 0 ? '✅ ถอดเฟอร์นิเจอร์สำเร็จ' : 'ℹ️ ไม่พบเฟอร์นิเจอร์')
                                    .setDescription(removedCount > 0 ? `ถอดเฟอร์นิเจอร์แล้ว **${removedCount}** รายการ\nคืนเข้าคลังเรียบร้อย` : 'ไม่มีเฟอร์นิเจอร์ให้ถอดในตำแหน่งที่เลือก')
                                    .setColor(removedCount > 0 ? '#BAFFC9' : '#E0E0E0');
                                await menu.followUp({ embeds: [resultEmbed], flags: MessageFlags.Ephemeral });
                            } catch (err) {
                                try { await session.abortTransaction(); } catch (_) {}
                                throw err;
                            } finally {
                                session.endSession();
                            }
                        });
                    }
                } else if(menu.isButton()) {
                    if (menu.customId === 'back_edit') {
                        await menu.deferUpdate();
                        await interaction.editReply({ content: '', embeds: [embed], components: [select, navButtons], files: [homeatt] });
            } else if (menu.customId === 'close_edit') {
                await menu.deferUpdate();
                const closeEmbed = new EmbedBuilder()
                    .setTitle('🔒 ปิดการแก้ไข')
                    .setDescription('ปิดเมนูแก้ไขบ้านเรียบร้อยแล้ว')
                    .setColor('#D4C5F9')
                    .setTimestamp()
                    
                await interaction.editReply({ content: '', embeds: [closeEmbed], components: [], files: [] });
                collector.stop();
                forceUnlock(userId);
            }
                }
            });

            collector.on('end', async (collected, reason) => {
                if(reason === 'time') {
                    const timed = new EmbedBuilder()
                        .setTitle('⏰ หมดเวลา')
                        .setDescription('หมดเวลาการแก้ไขบ้านแล้ว\nกรุณาใช้คำสั่งใหม่อีกครั้ง')
                        .setColor('#FFB3BA');

                    await interaction.editReply({ content: '', embeds: [timed], components: [], files: [] });
                }
                forceUnlock(userId);
            });

        } catch (error) {
            console.error('[HouseEdit] เกิดข้อผิดพลาด:', error);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ เกิดข้อผิดพลาด')
                .setDescription('ไม่สามารถดำเนินการได้\nกรุณาลองใหม่อีกครั้งในภายหลัง')
                .setColor('#FFB3BA')
                .setTimestamp()
                
            await interaction.editReply({ 
                content: '', 
                embeds: [errorEmbed], 
                components: [], 
                files: [] 
            });
            forceUnlock(userId);
        }
    }
}

module.exports.returnToRoot = async function returnToRoot(client, interaction, msg) {
    try {
        const canvas = Canvas.createCanvas(300, 300);
        const ctx = canvas.getContext("2d");
        const home = await GHome.findOne({ guild: interaction.guild.id, user: interaction.user.id });
        
        let homeedit;
        try {
            homeedit = await imageCache.getImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/modify.png");
        } catch (remoteError) {
            console.error('[HouseEdit] returnToRoot - ไม่สามารถโหลด modify.png:', remoteError);
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ เกิดข้อผิดพลาด')
                .setDescription('ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง')
                .setColor('#FFB3BA');
            return interaction.editReply({ content: '', embeds: [errorEmbed], components: [] });
        }
        
        if (!homeedit) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ เกิดข้อผิดพลาด')
                .setDescription('ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง')
                .setColor('#FFB3BA');
            return interaction.editReply({ content: '', embeds: [errorEmbed], components: [] });
        }
        ctx.drawImage(homeedit, 0, 0, canvas.width, canvas.height);
        const homeatt = new AttachmentBuilder(await canvas.encode("png"), { name: "modify.png" });

        const embed = new EmbedBuilder()
            .setAuthor({ name: `🏠 แก้ไขบ้านสัตว์เลี้ยง`, iconURL: `https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/734801251501604995.webp` })
            .setDescription('**เลือกเมนูที่ต้องการแก้ไข**')
            .addFields(
                { name: "🪑 เฟอร์นิเจอร์", value: "จัดวางและตกแต่งเฟอร์นิเจอร์ในบ้าน", inline: false },
                { name: "🔲 กระเบื้อง", value: "เปลี่ยนกระเบื้องให้สวยงาม", inline: false },
                { name: "🟦 วอลเปเปอร์", value: "เปลี่ยนวอลเปเปอร์ตกแต่งบ้าน", inline: false },
                { name: "🗑️ ถอดเฟอร์นิเจอร์", value: "ถอดเฟอร์นิเจอร์ออกจากบ้าน", inline: false }
            )
            .setImage("attachment://modify.png")
            .setFooter({ text: '💡 เลือกจากเมนูด้านล่างเพื่อเริ่มแก้ไข' })
            .setColor(client.color);

        const select = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("house")
                .setPlaceholder("เลือกเมนู")
                .setMaxValues(1)
                .setMinValues(1)
                .setOptions([
                    { label: "1️⃣ เฟอร์นิเจอร์", description: "แก้ไขเฟอร์นิเจอร์", value: "fur" },
                    { label: "2️⃣ กระเบื้อง", description: "แก้ไขกระเบื้อง", value: "floor" },
                    { label: "3️⃣ วอลเปเปอร์", description: "แก้ไขวอลเปเปอร์", value: "tile" },
                    { label: "4️⃣ ถอดเฟอร์นิเจอร์", description: "ถอดเฟอร์นิเจอร์", value: "remove" },
                ])
        );
        const navButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('back_edit').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('close_edit').setLabel('ปิด').setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({ content: '', embeds: [embed], components: [select, navButtons], files: [homeatt] });

        let filter = (m) => m.user.id === interaction.user.id;
        let collector = await msg.createMessageComponentCollector({ filter, time: 180000 });
        collector.on('collect', async (menu) => {
            if(menu.isStringSelectMenu()) {
                if(menu.customId === "house") {
                    await menu.deferUpdate();
                    let [directory] = menu.values;
                    if (directory === "fur") {
                        const { selectFurniture } = require("../../structures/select/furniture.js");
                        selectFurniture(client, interaction, msg);
                        collector.stop();
                    } else if (directory === "floor") {
                        const { selectFloor } = require("../../structures/select/floor.js");
                        selectFloor(client, interaction, msg);
                        collector.stop();
                    } else if (directory === "tile") {
                        const { selectTile } = require("../../structures/select/tile.js");
                        selectTile(client, interaction, msg);
                        collector.stop();
                    } else if (directory === "remove") {
                        const homeCurrent = await GHome.findOne({ guild: interaction.guild.id, user: interaction.user.id }).lean();
                        const options = buildRemoveOptions(homeCurrent);
                        
                        if (options.length === 0) {
                            const noItemEmbed = new EmbedBuilder()
                                .setTitle('📭 ไม่มีเฟอร์นิเจอร์')
                                .setDescription('ไม่มีเฟอร์นิเจอร์ให้ถอดในบ้านของคุณ')
                                .setColor('#E0E0E0');
                            await interaction.editReply({ 
                                content: '', 
                                embeds: [noItemEmbed], 
                                components: [navButtons], 
                                files: [] 
                            });
                            return;
                        }
                        const selectRemove = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('remove_select')
                                .setPlaceholder('เลือกตำแหน่งที่จะถอด')
                                .setMaxValues(1)
                                .setMinValues(1)
                                .setOptions(options)
                        );
                        let embedsToShow = [];
                        let filesToAttach = [];
                        try {
                            if (homeCurrent.house) {
                                const buf = await fetchBuffer(homeCurrent.house);
                                const att = new AttachmentBuilder(buf, { name: 'house.png' });
                                const houseEmbed = new EmbedBuilder()
                                    .setTitle('🏠 บ้านของคุณ')
                                    .setDescription('เลือกตำแหน่งที่ต้องการถอดเฟอร์นิเจอร์')
                                    .setImage('attachment://house.png')
                                    .setColor(client.color);
                                embedsToShow = [houseEmbed];
                                filesToAttach = [att];
                            } else {
                                const queue = getRenderQueue();
                                const payload = {
                                    guild: interaction.guild.id,
                                    user: interaction.user.id,
                                    size: { width: 300, height: 300 },
                                    format: 'png',
                                    layers: buildHouseLayers(homeCurrent),
                                };
                                const { jobId } = await queue.enqueue(payload);
                                const result = await queue.waitForResult(jobId);
                                const buf = await fetchBuffer(result.url);
                                const att = new AttachmentBuilder(buf, { name: 'house.png' });
                                const houseEmbed = new EmbedBuilder()
                                    .setTitle('🏠 บ้านของคุณ')
                                    .setDescription('เลือกตำแหน่งที่ต้องการถอดเฟอร์นิเจอร์')
                                    .setImage('attachment://house.png')
                                    .setColor(client.color);
                                embedsToShow = [houseEmbed];
                                filesToAttach = [att];
                            }
                        } catch (e) {
                            embedsToShow = [embed];
                            filesToAttach = [homeatt];
                        }
                        await interaction.editReply({ content: '', embeds: embedsToShow, components: [selectRemove, navButtons], files: filesToAttach });
                    }
                }
            } else if (menu.isButton()) {
                if (menu.customId === 'close_edit') {
                    await menu.deferUpdate();
                    const closeEmbed = new EmbedBuilder()
                        .setTitle('🔒 ปิดการแก้ไข')
                        .setDescription('ปิดเมนูแก้ไขบ้านเรียบร้อยแล้ว')
                        .setColor('#D4C5F9')
                        .setTimestamp();
                    await interaction.editReply({ content: '', embeds: [closeEmbed], components: [], files: [] });
                    collector.stop();
                    forceUnlock(interaction.user.id);
                }
            }
        });
        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timed = new EmbedBuilder()
                    .setTitle('⏰ หมดเวลา')
                    .setDescription('หมดเวลาการแก้ไขบ้านแล้ว\nกรุณาใช้คำสั่งใหม่อีกครั้ง')
                    .setColor('#FFB3BA');
                await interaction.editReply({ content: '', embeds: [timed], components: [], files: [] });
            }
            forceUnlock(interaction.user.id);
        });
    } catch (e) {
        console.error('[HouseEdit] returnToRoot - เกิดข้อผิดพลาด:', e);
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ เกิดข้อผิดพลาด')
            .setDescription('ไม่สามารถดำเนินการได้\nกรุณาลองใหม่อีกครั้ง')
            .setColor('#FFB3BA')
            .setTimestamp();
        await interaction.editReply({ content: '', embeds: [errorEmbed], components: [] });
        forceUnlock(interaction.user.id);
    }
}
