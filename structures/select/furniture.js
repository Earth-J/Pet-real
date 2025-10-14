const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { editFurnitureA } = require("../edit/furnitureNew.js")
const GInv = require("../../settings/models/inventory.js");
const GHome = require("../../settings/models/house.js");
const { getRenderQueue } = require("../services/renderQueueSingleton");
const { fetchBuffer } = require("../services/discordUpload");
const { buildHouseLayers } = require("../services/layout");
const { forceUnlock } = require("../edit/furnitureUnified.js");
const { getEmotionKey } = require("../services/petEmotion");
const { invToArray, filterInventory } = require("../utils/inventoryHelper");

function getFurnitureEmoji(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('sofa') || n.includes('couch')) return '<:752439451241807884:1312409263896920145>';
    if (n.includes('tv')) return '📺';
    if (n.includes('fridge') || n.includes('freez')) return '🧊';
    if (n.includes('tree') || n.includes('plant')) return '🌳';
    if (n.includes('trash') || n.includes('bin')) return '🗑️';
    if (n.includes('chest') || n.includes('box')) return '🧰';
    return '🪑';
}

const selectFurniture = async (client, interaction, msg) => {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    const object = filterInventory(inv, x => x.type === "furniture");

    // เตรียมภาพบ้าน + โอเวอร์เลย์กริดเลือกตำแหน่ง
    async function renderHouseSelectionImage() {
        try {
            const home = await GHome.findOne({ guild: interaction.guild.id, user: interaction.user.id }).lean();
            if (!home) return null;
            let layers = buildHouseLayers(home);
            // แทรกภาพโอเวอร์เลย์กริดเลือกตำแหน่งทับทั้งหมด
            layers.push({
                type: 'static',
                url: 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/select_Furnitureedit.png',
                draw: { x: 0, y: 0, w: 300, h: 300 },
            });
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
            return buffer;
        } catch (_) {
            return null;
        }
    }

    if(object.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('📦 ไม่มีเฟอร์นิเจอร์')
            .setDescription('คุณยังไม่มีเฟอร์นิเจอร์ในคลัง')
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
            const emoji = getFurnitureEmoji(key.name);
            return `${indexLabel}. ${emoji} ${toOppositeCase(key.name)}`;
        });
        const emb = new EmbedBuilder()
            .setAuthor({ name: `🪑 เลือกเฟอร์นิเจอร์`, iconURL: `https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/734801251501604995.webp` })
            .setDescription(`**พิมพ์หมายเลขเพื่อเลือกเฟอร์นิเจอร์** (เช่น 1, 2, 3)\n\n${lines.length ? lines.join("\n") : "-"}`)
            .setFooter({ text: `📝 ขั้นตอนถัดไปจะให้พิมพ์ตำแหน่ง (A1, B2, C3, D4)` })
            .setColor('#BAE1FF');
        return emb;
    };

    const buildPageNavRow = () => null; // ปิดการใช้งานปุ่มนำทาง

    const backCloseRow = null; // ปิดการใช้งานปุ่มย้อนกลับ/ปิด

    await interaction.editReply({ embeds: [buildEmbed()], components: [], files: [] });

    let filter = (m) => m.user.id === interaction.user.id;
    // ปิดการใช้งานตัวเก็บปุ่ม (ไม่มีปุ่มแล้ว)
    let collector = { stop() {}, on() {} };

    // message collector for numeric input (and warn on invalid input)
    const msgFilter = (m) => m.author && m.author.id === interaction.user.id;
    const messageCollector = interaction.channel.createMessageCollector({ filter: msgFilter, time: 300000 });

    // ไม่มีปุ่มให้เก็บเหตุการณ์อีกต่อไป

    messageCollector.on('collect', async (m) => {
        const raw = m.content.trim();
        if (!/^\d+$/.test(raw)) {
            const warnEmbed = new EmbedBuilder()
                .setDescription('⚠️ **กรุณาพิมพ์ตัวโจท่านั้น** (เช่น 1, 2, 3)')
                .setColor('#FFDFBA');
            const warn = await m.reply({ embeds: [warnEmbed], allowedMentions: { repliedUser: false } }).catch(() => null);
            if (warn && warn.delete) { try { await warn.delete().catch(() => {}); } catch {} }
            try { await m.delete().catch(() => {}); } catch {}
            return;
        }
        const idx = parseInt(raw, 10);
        if (idx < 1 || idx > object.length) {
            const warnEmbed = new EmbedBuilder()
                .setDescription(`⚠️ **กรุณาพิมพ์เลข 1-${object.length}** เท่านั้น`)
                .setColor('#FFDFBA');
            const warn = await m.reply({ embeds: [warnEmbed], allowedMentions: { repliedUser: false } }).catch(() => null);
            if (warn && warn.delete) { try { await warn.delete().catch(() => {}); } catch {} }
            try { await m.delete().catch(() => {}); } catch {}
            return;
        }
        const selected = object[idx - 1];
        try {
            await m.delete().catch(() => {});
        } catch {}
        // หยุดตัวเก็บข้อความเดิมก่อน เพื่อไม่ให้กินข้อความตำแหน่ง
        collector.stop();
        messageCollector.stop();
        // หน่วงสั้น ๆ เพื่อให้ตัวเก็บใหม่ในหน้าแก้ไขพร้อมก่อนรับอินพุตถัดไป
        await new Promise(r => setTimeout(r, 25));
        // ไปต่อขั้นตอนแก้ไขโดยส่งต่อข้อมูลเฟอร์นิเจอร์ที่เลือก (ให้ตัวแก้ไขเป็นผู้แสดง prompt และเก็บอินพุต)
        await editFurnitureA(client, interaction, msg, selected.name, selected.type, selected.id);
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            const timed = new EmbedBuilder()
                .setTitle('⏰ หมดเวลา')
                .setDescription('หมดเวลาการเลือกเฟอร์นิเจอร์แล้ว\nกรุณาใช้คำสั่งใหม่อีกครั้ง')
                .setColor('#FFB3BA');

            interaction.editReply({ content: '', embeds: [timed], components: [] });
        }
        // ลบการล็อคเมื่อหมดเวลา
        forceUnlock(interaction.user.id);
    });

    messageCollector.on('end', () => {
        // ลบการล็อคเมื่อ message collector หมดเวลา
        forceUnlock(interaction.user.id);
    });

   return;
}

function toOppositeCase(char) {
    return char.charAt(0).toUpperCase() + char.slice(1);
}

module.exports = { selectFurniture };