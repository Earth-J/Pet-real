const { EmbedBuilder, ActionRowBuilder, AttachmentBuilder, ButtonStyle, ButtonBuilder } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const GInv = require("../../settings/models/inventory.js");
const GHouse = require("../../settings/models/house.js");
const { getRenderQueue } = require("../services/renderQueueSingleton");
const { isLocalServiceUrl, fetchBuffer, uploadFromUrlToInteraction } = require("../services/discordUpload");
const { buildHouseLayers } = require("../services/layout");
const { findInInventory } = require("../utils/inventoryHelper");

const editTile = async (client, interaction, msg, item, type, id) => {
    if (!interaction?.channel) {
        throw new Error('Channel is inaccessible.');
    }

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    // Initialize TILE_DATA if not exists
    if (!home.TILE_DATA) {
        home.TILE_DATA = { TILE: false, TILEI: null };
    }

    const check = findInInventory(inv, x => x.id === id);

    // Check if tile already placed
    if (home.TILE_DATA.TILEI === check.name) {
        await interaction.followUp({ 
            content: "คุณวางวอลเปเปอร์นี้แล้ว!", 
            ephemeral: true 
        });
        return;
    }

    // Store original values for rollback
    const originalTile = home.TILE_DATA.TILE;
    const originalTileI = home.TILE_DATA.TILEI;

    // Rollback helper
    const rollbackTile = () => {
        home.TILE_DATA.TILE = originalTile;
        home.TILE_DATA.TILEI = originalTileI;
    };

    // คืน tile เก่ากลับคลังก่อนวางของใหม่
    if (originalTileI && originalTileI !== check.name) {
        const { returnItemToInventory } = require('./removeFurniture.js');
        await returnItemToInventory(inv, originalTileI, 'tile');
    }

    // Temporarily update tile data (not saved until user clicks Save)
    home.TILE_DATA.TILE = true;
    home.TILE_DATA.TILEI = check.name;

    const queue = getRenderQueue();

    try {
        // Show ephemeral loading message
        const loadingMsg = await interaction.followUp({ 
            content: `🧩 อัปเดตกระเบื้องสำเร็จ กำลังเรนเดอร์ ตัวอย่างบ้าน...`, 
            ephemeral: true 
        });
        
        setTimeout(() => loadingMsg.delete().catch(() => {}), 1000);

        // Request render
        const { jobId } = await queue.enqueue({
            guild: interaction.guild.id,
            user: interaction.user.id,
            size: { width: 300, height: 300 },
            format: 'png',
            layers: buildHouseLayers(home),
        });

        const result = await queue.waitForResult(jobId);
        const buf = await fetchBuffer(result.url);

        // Build preview embed and buttons
        const embed = new EmbedBuilder()
            .setTitle('ตัวอย่างบ้านของคุณ')
            .setImage('attachment://preview.png')
            .setColor(client.color);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('preview_save_tile')
                .setLabel('บันทึก')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('preview_back_tile')
                .setLabel('ย้อนกลับ')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('preview_cancel_tile')
                .setLabel('ยกเลิก')
                .setStyle(ButtonStyle.Danger)
        );

        const attachment = new AttachmentBuilder(buf, { name: 'preview.png' });

        // Show preview with buttons
        await interaction.editReply({ 
            content: null,
            embeds: [embed], 
            components: [buttons], 
            files: [attachment] 
        });

        // Create collector for button interactions
        const filter = (i) => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 300000 
        });

        let processed = false;

        collector.on('collect', async (i) => {
            await i.deferUpdate();

            if (processed) return;
            processed = true;

            // disable buttons immediately
            const disabledButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('preview_save_tile').setLabel('บันทึก').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('preview_back_tile').setLabel('ย้อนกลับ').setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('preview_cancel_tile').setLabel('ยกเลิก').setStyle(ButtonStyle.Danger).setDisabled(true)
            );
            try { await interaction.editReply({ components: [disabledButtons] }); } catch {}

            switch (i.customId) {
                case 'preview_save_tile': {
                    collector.stop();
                    let finalUrl = result.url;
                    if (isLocalServiceUrl(finalUrl, process.env.RENDER_SERVICE_URL)) {
                        const uploaded = await uploadFromUrlToInteraction(
                            interaction, 
                            finalUrl, 
                            `house.${result.format === 'gif' ? 'gif' : 'png'}`
                        );
                        if (uploaded) finalUrl = uploaded;
                    }
                    // remove item from inventory
                    try {
                        const idx = inv.item.findIndex(x => x.id === id);
                        if (idx !== -1) {
                            inv.item.splice(idx, 1);
                            await inv.save();
                        }
                    } catch {}

                    // persist house image and tile state
                    home.house = finalUrl;
                    if (!home.TILE_DATA) home.TILE_DATA = { TILE: false, TILEI: "" };
                    home.TILE_DATA.TILE = true;
                    home.TILE_DATA.TILEI = check?.name || home.TILE_DATA.TILEI || "";
                    await home.save();

                    const savedEmbed = new EmbedBuilder().setColor(client.color).setDescription('บันทึกบ้านเรียบร้อยแล้ว');
                    await interaction.editReply({ embeds: [savedEmbed], components: [], files: [] });
                    break;
                }

                case 'preview_back_tile': {
                    processed = false; // allow new actions after back
                    rollbackTile();
                    collector.stop();
                    
                    const { selectTile } = require('../select/tile.js');
                    const message = await interaction.fetchReply();
                    await selectTile(client, interaction, message);
                    break;
                }

                case 'preview_cancel_tile': {
                    processed = false;
                    rollbackTile();
                    collector.stop();
                    
                    await interaction.editReply({ 
                        content: 'ยกเลิกแล้ว',
                        embeds: [], 
                        components: [], 
                        files: [] 
                    });
                    break;
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                rollbackTile();
                
                await interaction.editReply({ 
                    content: 'หมดเวลา ยกเลิกการแก้ไข',
                    embeds: [], 
                    components: [], 
                    files: [] 
                }).catch(() => {});
            }
        });

    } catch (error) {
        console.error('Error rendering tile preview:', error);
        
        // Fallback: Show simple canvas image
        const canvas = Canvas.createCanvas(300, 300);
        const ctx = canvas.getContext("2d");
        const place_on = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png");
        ctx.drawImage(place_on, 0, 0, canvas.width, canvas.height);
        
        const attachment = new AttachmentBuilder(await canvas.encode("png"), { name: `${item}.png` });
        
        await interaction.editReply({ 
            content: null,
            embeds: [], 
            components: [], 
            files: [attachment] 
        });
        
        const replyMessage = await interaction.fetchReply();
        await saveTILE(interaction, id, replyMessage, replyMessage, check);
    }
};

module.exports = { editTile };
