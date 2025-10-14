const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { editTile } = require("../edit/tile.js");
const GInv = require("../../settings/models/inventory.js");
const { forceUnlock } = require("../edit/furnitureUnified.js");
const { filterInventory } = require("../utils/inventoryHelper");

function getTileEmoji(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('wood')) return '🪵';
    if (n.includes('iron')) return '⚙️';
    if (n.includes('gold')) return '🥇';
    if (n.includes('diamond')) return '💎';
    if (n.includes('emerald')) return '🟩';
    if (n.includes('marble')) return '⬜';
    if (n.includes('stone')) return '🪨';
    return '🟫';
}

function toOppositeCase(char) {
    return char.charAt(0).toUpperCase() + char.slice(1);
}

const selectTile = async (client, interaction, msg) => {
    if (!interaction?.channel) {
        throw new Error('Channel is inaccessible.');
    }

    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    if (!inv) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ ไม่พบข้อมูล')
            .setDescription('ไม่พบข้อมูลคลังสินค้าของคุณ')
            .setColor('#FFB3BA');
        return interaction.editReply({ content: '', embeds: [errorEmbed], files: [], components: [] });
    }

    const object = filterInventory(inv, x => x.type === "tile");

    if (object.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('📦 ไม่มีวอลเปเปอร์')
            .setDescription('คุณยังไม่มีวอลเปเปอร์ในคลัง')
            .setColor('#E0E0E0');
        return interaction.editReply({ content: '', embeds: [emptyEmbed], files: [], components: [] });
    }

    const pageSize = 5;
    let page = 0;
    const totalPages = Math.ceil(object.length / pageSize);

    const buildEmbed = () => {
        const start = page * pageSize;
        const slice = object.slice(start, start + pageSize);
        const lines = slice.map((key, idx) => {
            const indexLabel = start + idx + 1;
            const emoji = getTileEmoji(key.name);
            return `${indexLabel}. ${emoji} ${toOppositeCase(key.name)}`;
        });
        return new EmbedBuilder()
            .setAuthor({ 
                name: `🏠 เลือกวอลเปเปอร์`, 
                iconURL: `https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/734801251501604995.webp` 
            })
            .setDescription(
                `**เลือกวอลเปเปอร์ที่ต้องการวาง**\nพิมพ์ตัวเลขเพื่อเลือก (เช่น 1, 2, 3)\n\n${lines.length ? lines.join("\n") : "-"}`
            )
            .setFooter({ text: `📝 พิมพ์ตัวเลขในแชทเพื่อเลือก` })
            .setColor('#BAE1FF');
    };

    const buildPageNavRow = () => {
        const displayPage = Math.min(page + 1, Math.max(totalPages, 1));
        const maxPage = Math.max(totalPages, 1);
        
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('tile_prev')
                .setLabel('⬅')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page <= 0),
            new ButtonBuilder()
                .setCustomId('tile_label')
                .setLabel(`${displayPage} / ${maxPage}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('tile_next')
                .setLabel('➡')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= totalPages - 1 || totalPages === 0)
        );
    };

    const backCloseRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('back_edit')
            .setLabel('ย้อนกลับ')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('close_edit')
            .setLabel('ปิด')
            .setStyle(ButtonStyle.Danger)
    );

    const filter = (m) => m.user.id === interaction.user.id;
    const collector = await interaction.editReply({ 
        embeds: [buildEmbed()], 
        components: [buildPageNavRow(), backCloseRow], 
        files: [] 
    }).then(message => message.createMessageComponentCollector({ filter, time: 300000 }));

    const msgFilter = (m) => m.author?.id === interaction.user.id;
    const messageCollector = interaction.channel.createMessageCollector({ filter: msgFilter, time: 300000 });

    const stopCollectors = () => {
        collector.stop();
        messageCollector.stop();
        forceUnlock(interaction.user.id);
    };

    const deleteMessage = async (msg) => {
        try {
            await msg.delete();
        } catch {}
    };

    const showWarning = async (m, content) => {
        const warn = await m.reply({ 
            content, 
            allowedMentions: { repliedUser: false } 
        }).catch(() => null);
        
        if (warn?.delete) {
            try { 
                await warn.delete(); 
            } catch {}
        }
        await deleteMessage(m);
    };

    const showWarningEmbed = async (m, embed) => {
        const warn = await m.reply({ 
            embeds: [embed], 
            allowedMentions: { repliedUser: false } 
        }).catch(() => null);
        
        if (warn?.delete) {
            try { 
                await warn.delete(); 
            } catch {}
        }
        await deleteMessage(m);
    };

    collector.on('collect', async (menu) => {
        if (!menu.isButton()) return;
        
        await menu.deferUpdate();

        switch (menu.customId) {
            case 'tile_prev':
                if (page > 0) page--;
                await interaction.editReply({ 
                    embeds: [buildEmbed()], 
                    components: [buildPageNavRow(), backCloseRow] 
                });
                break;

            case 'tile_next':
                if (page < totalPages - 1) page++;
                await interaction.editReply({ 
                    embeds: [buildEmbed()], 
                    components: [buildPageNavRow(), backCloseRow] 
                });
                break;

            case 'back_edit':
                stopCollectors();
                const HouseEdit = require("../../commands/Pet/HouseEdit.js");
                if (typeof HouseEdit.returnToRoot === 'function') {
                    const message = await interaction.fetchReply();
                    await HouseEdit.returnToRoot(client, interaction, message);
                } else {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ ไม่สามารถย้อนกลับ')
                        .setDescription('กรุณาใช้คำสั่ง `/house edit` ใหม่อีกครั้ง')
                        .setColor('#FFB3BA');
                    await interaction.editReply({ 
                        content: '', 
                        embeds: [errorEmbed], 
                        components: [] 
                    });
                }
                break;

            case 'close_edit':
                const closeEmbed = new EmbedBuilder()
                    .setTitle('🔒 ปิดการแก้ไข')
                    .setDescription('ปิดเมนูแก้ไขบ้านเรียบร้อยแล้ว')
                    .setColor('#D4C5F9')
                    .setTimestamp();
                await interaction.editReply({ 
                    content: '', 
                    embeds: [closeEmbed], 
                    components: [], 
                    files: [] 
                });
                stopCollectors();
                break;
        }
    });

    messageCollector.on('collect', async (m) => {
        const raw = m.content.trim();
        
        if (!/^\d+$/.test(raw)) {
            const warnEmbed = new EmbedBuilder()
                .setDescription('⚠️ **กรุณาพิมพ์ตัวเลขเท่านั้น** (เช่น 1, 2, 3)')
                .setColor('#FFDFBA');
            await showWarningEmbed(m, warnEmbed);
            return;
        }

        const idx = parseInt(raw, 10);
        if (idx < 1 || idx > object.length) {
            const warnEmbed = new EmbedBuilder()
                .setDescription(`⚠️ **กรุณาพิมพ์เลข 1-${object.length}** เท่านั้น`)
                .setColor('#FFDFBA');
            await showWarningEmbed(m, warnEmbed);
            return;
        }

        const selected = object[idx - 1];
        await deleteMessage(m);
        await editTile(client, interaction, msg, selected.name, selected.type, selected.id);
        stopCollectors();
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            const timed = new EmbedBuilder()
                .setTitle('⏰ หมดเวลา')
                .setDescription('หมดเวลาการเลือกวอลเปเปอร์แล้ว\nกรุณาใช้คำสั่งใหม่อีกครั้ง')
                .setColor('#FFB3BA');

            await interaction.editReply({ content: '', embeds: [timed], components: [] });
        }
        forceUnlock(interaction.user.id);
    });

    messageCollector.on('end', () => {
        forceUnlock(interaction.user.id);
    });

    return;
};

module.exports = { selectTile };
