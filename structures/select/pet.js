const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, SelectMenuOptionBuilder } = require("discord.js");
const GPet = require("../../settings/models/pet.js");
const GInv = require("../../settings/models/inventory.js");
const { getEmotionKey } = require("../services/petEmotion");
const { getPoseKey } = require("../services/petPose");
const { getRenderQueue } = require("../services/renderQueueSingleton");
const { fetchBuffer } = require("../services/discordUpload");
const { updateFireStreak } = require("../../handlers/FireStreakHandler");

const PET_ASSET_BASE_URL = (process.env.PET_ASSET_BASE_URL || 'https://cdn.kitsxkorn.xyz').replace(/\/$/, '');
const PET_ASSET_PATH_PREFIX = (process.env.PET_ASSET_PATH_PREFIX || '').replace(/^\/+|\/+$/g, '');
function buildCdnUrl(...segs) { const parts = [PET_ASSET_BASE_URL]; if (PET_ASSET_PATH_PREFIX) parts.push(PET_ASSET_PATH_PREFIX); for (const s of segs) { const v = String(s || '').trim().replace(/^\/+|\/+$/g, ''); if (v) parts.push(v);} return parts.join('/'); }
function cdnPetStaticUrl(state, type) { return buildCdnUrl('pet', state, `${type}.png`); }
async function makePetThumbAttachment(petDoc, state) {
  try {
    const queue = getRenderQueue();
    const size = { width: 96, height: 96 };
    const staticUrl = cdnPetStaticUrl(state, petDoc.type);
    const bounce = [0, -2, 0, 2, 0, 0];
    const frames = bounce.map(dy => ({ url: staticUrl, draw: { x: 20, y: 15 + dy, w: 56, h: 60 } }));
    const payload = { guild: 'g', user: 'u', size, format: 'gif', gifOptions: { delayMs: parseInt(process.env.PET_GIF_DELAY_MS || '210'), repeat: 0, quality: parseInt(process.env.PET_GIF_QUALITY || '10'), transparent: true }, layers: [{ type: 'pet_gif_frames', frames }] };
    const { jobId } = await queue.enqueue(payload);
    const result = await queue.waitForResult(jobId);
    const buf = await fetchBuffer(result.url);
    return new AttachmentBuilder(buf, { name: 'pet_thumb.gif' });
  } catch (_) { return null; }
}

const petSelect = async function (client, interaction, msg, id) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const pet = await GPet.find({ guild: interaction.guild.id, user: interaction.user.id });

    const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription("*กรุณาเลือกสัตว์เลี้ยงที่จะให้อาหาร*")

    const select = new ActionRowBuilder()
        .addComponents([
            new StringSelectMenuBuilder()
                .setCustomId("feedpet")
                .setPlaceholder("เลือกสัตว์เลี้ยงที่จะให้อาหาร")
                .setMaxValues(1)
                .setMinValues(1)
                .setOptions(pet.map(key => {
                    return new SelectMenuOptionBuilder()
                        .setLabel(`${toOppositeCase(key.name)}`)
                        .setValue(key.type)
                    }
                ))
            ])

    await msg.edit({ content: " ", embeds: [embed], components: [select] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isStringSelectMenu()) {
            // id select menus
            if(menu.customId === "feedpet") {
                await menu.deferUpdate();
                /// value id
                let [ directory ] = menu.values;

                const item = inv.item.find(x => x.id === id);

                //pet 
                const mypet = await GPet.findOne({ guild: interaction.guild.id, user: interaction.user.id, type: directory });

                if (!mypet) {
                    await menu.followUp({ content: 'ไม่พบสัตว์เลี้ยงที่เลือก', ephemeral: true });
                    return;
                }

                const clamp = (n, lo = 0, hi = 20) => Math.max(lo, Math.min(hi, Number(n || 0)));
                const sign = (n) => n >= 0 ? `+${n}` : `${n}`;

                // ก่อนเปลี่ยน
                const before = {
                  fullness: Number(mypet.fullness ?? mypet.hungry ?? 0),
                  affection: Number(mypet.affection ?? 0),
                };

                // EXP จากอาหาร
                const expGain = Number(item.exp || 1); // ใช้ EXP จากอาหาร
                mypet.exp = Number(mypet.exp || 0) + expGain;

                // ใช้สคีมาใหม่: เพิ่มความอิ่ม
                const nextFullness = clamp(before.fullness + Number(item.feed || 0));
                mypet.fullness = nextFullness;
                // sync legacy hungry เพื่อความเข้ากันได้ย้อนหลัง
                mypet.hungry = nextFullness;

                // เพิ่มเอ็นดูเล็กน้อยเมื่อให้อาหาร
                mypet.affection = clamp(before.affection + 1);

                // อัปเดตเลเวลถ้าเกิน
                if(Number(mypet.exp) >= Number(mypet.nextexp)) {
                    let diff = Number(mypet.exp) - Number(mypet.nextexp);

                    mypet.level = Number(mypet.level || 1) + 1;
                    mypet.nextexp = Math.floor(mypet.level * mypet.level * 1.5);
                    mypet.exp = diff;
                }

                // ลบไอเท็มอาหารออกจากกระเป๋า
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);

                // อัปเดต fire streak
                await updateFireStreak(interaction.guild.id, interaction.user.id);

                await Promise.all([mypet.save(), inv.save()]);

                const after = { fullness: mypet.fullness, affection: mypet.affection };
                const deltas = [];
                if (after.fullness !== before.fullness) deltas.push(`ความอิ่ม (Fullness): ${after.fullness} / 20 (\`${sign(after.fullness - before.fullness)}\`)`);
                if (after.affection !== before.affection) deltas.push(`เอ็นดู (Affection): ${after.affection} / 20 (\`${sign(after.affection - before.affection)}\`)`);

                const lines = [
                  `ให้อาหาร **${mypet.name}** แล้ว!`,
                  "",
                  "อัปเดตค่าสถานะ",
                  ...deltas,
                  `เลเวล: ${mypet.level} • ต้องการอีก ${mypet.nextexp - mypet.exp} XP เพื่อเลเวลถัดไป`
                ];

                // thumbnail GIF
                const state = getEmotionKey(mypet);
                const thumbAtt = await makePetThumbAttachment(mypet, state);

                const done = new EmbedBuilder()
                    .setColor(client.color)
                    .setAuthor({ name: `${interaction.user.username}`, iconURL: interaction.user.avatarURL()})
                    .setDescription(lines.join("\n"))
                    .setTimestamp()

                const files = [];
                if (thumbAtt) {
                  files.push(thumbAtt);
                  done.setThumbnail('attachment://pet_thumb.gif');
                } else {
                  done.setThumbnail(cdnPetStaticUrl(state, mypet.type));
                }

                msg.edit({ content: " ", embeds: [done], components: [], files });
                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            const timed = new EmbedBuilder()
                .setDescription(`หมดเวลาแล้ว`)
                .setColor(client.color)

            msg.edit({ embeds: [timed], components: [] });
        }
    });
}

function toOppositeCase(char) {
    return char.charAt(0).toUpperCase() + char.slice(1);
}

module.exports = { petSelect };