const { EmbedBuilder, ApplicationCommandOptionType, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const mongoose = require("mongoose");
const GInv = require("../../settings/models/inventory.js");
const GProfile = require("../../settings/models/profile.js");
const GHome = require("../../settings/models/house.js");
const { withUserLock } = require("../../structures/services/userLock.js");
const { getEditingStatus } = require("../../structures/edit/furnitureUnified.js");

module.exports = {
    name: ["โอนไอเทม"],
    description: "โอนไอเทมให้ผู้ใช้อื่น",
    category: "General",
    options: [
        {
            name: "ผู้ใช้",
            type: ApplicationCommandOptionType.User,
            description: "เลือกผู้รับไอเทม",
            required: true
        },
        {
            name: "ประเภท",
            type: ApplicationCommandOptionType.String,
            description: "ประเภทไอเทม",
            required: true,
            choices: [
                { name: "เฟอร์นิเจอร์", value: "furniture" },
                { name: "กระเบื้อง", value: "floor" },
                { name: "วอลเปเปอร์", value: "tile" },
                { name: "อาหาร", value: "food" }
            ]
        }
    ],
    run: async (client, interaction) => {
        const sender = interaction.user;
        const receiver = interaction.options.getUser("ผู้ใช้");
        const type = interaction.options.getString("ประเภท");

        if (receiver.bot) return interaction.reply({ content: "ไม่สามารถโอนของให้บอทได้", ephemeral: true });
        if (receiver.id === sender.id) return interaction.reply({ content: "ไม่สามารถโอนของให้ตัวเองได้", ephemeral: true });

        const guildId = interaction.guild.id;

        // ป้องกันโอนระหว่างกำลังแก้ไขบ้าน (ลด race/ความสับสน)
        if (type !== 'food') {
            const status = getEditingStatus(sender.id);
            if (status && status.isEditing) {
                return interaction.reply({ content: "คุณกำลังแก้ไขบ้านอยู่ กรุณาปิดโหมดแก้ไขก่อนโอนไอเทม", ephemeral: true });
            }
        }

        // แสดงเมนูเลือกชื่อไอเท็มจากหมวดที่เลือก
        const invPreview = await GInv.findOne({ guild: guildId, user: sender.id }).lean();
        if (!invPreview || !Array.isArray(invPreview.item)) {
            return interaction.reply({ content: "ไม่พบคลังไอเท็มของคุณ", ephemeral: true });
        }
        const itemsByType = invPreview.item.filter(x => x && x.type === type);
        if (itemsByType.length === 0) {
            return interaction.reply({ content: "ไม่มีไอเท็มในหมวดนี้", ephemeral: true });
        }
        // เตรียมข้อมูลบ้านเพื่อคำนวณจำนวนที่ไม่ถูกวาง (unplaced)
        const homePreview = await GHome.findOne({ guild: guildId, user: sender.id }).lean();

        // นับจำนวนต่อชื่อ และจำนวนที่ถูกวางอยู่
        const nameToCounts = new Map(); // { name: { total, placed } }
        for (const it of itemsByType) {
            const key = typeof it.name === 'string' ? it.name : 'unknown';
            const entry = nameToCounts.get(key) || { total: 0, placed: 0 };
            entry.total += 1;
            nameToCounts.set(key, entry);
        }

        if (homePreview && (type === 'floor' || type === 'tile' || type === 'furniture')) {
            for (const [n, entry] of nameToCounts.entries()) {
                const nLc = n.toLowerCase();
                if (type === 'floor') {
                    const placed = homePreview.FLOOR_DATA && homePreview.FLOOR_DATA.FLOOR && typeof homePreview.FLOOR_DATA.FLOORI === 'string' && homePreview.FLOOR_DATA.FLOORI.toLowerCase() === nLc;
                    entry.placed += placed ? 1 : 0;
                } else if (type === 'tile') {
                    const placed = homePreview.TILE_DATA && homePreview.TILE_DATA.TILE && typeof homePreview.TILE_DATA.TILEI === 'string' && homePreview.TILE_DATA.TILEI.toLowerCase() === nLc;
                    entry.placed += placed ? 1 : 0;
                } else if (type === 'furniture') {
                    const sections = ['A_DATA','B_DATA','C_DATA','D_DATA'];
                    let pc = 0;
                    for (const sec of sections) {
                        const data = homePreview[sec];
                        if (!data) continue;
                        for (let i = 1; i <= 4; i++) {
                            const flag = data[`${sec[0]}${i}`];
                            const itemName = data[`${sec[0]}${i}I`];
                            if (flag && typeof itemName === 'string' && itemName.toLowerCase() === nLc) pc++;
                        }
                    }
                    entry.placed += pc;
                }
                nameToCounts.set(n, entry);
            }
        }

        // สร้างเมนู: แสดงชื่อพร้อมจำนวนที่โอนได้ตอนนี้ (total - placed)
        const selectOptions = Array.from(nameToCounts.entries())
            .map(([n, entry]) => ({ name: n, available: Math.max(0, (entry.total || 0) - (entry.placed || 0)), total: entry.total || 0 }))
            .filter(x => x.available > 0)
            .slice(0, 25)
            .map(x => ({ label: `${x.name} (x${x.available}/${x.total})`, value: x.name }));

        if (selectOptions.length === 0) {
            return interaction.reply({ content: "ไม่มีไอเท็มที่โอนได้ในหมวดนี้ (ของที่มีอาจกำลังถูกวางอยู่ในบ้าน)", ephemeral: true });
        }
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('transfer_select_name')
                .setPlaceholder('เลือกไอเท็มที่จะโอน')
                .addOptions(selectOptions)
        );
        await interaction.reply({ content: "โปรดเลือกไอเท็มที่ต้องการโอน:", components: [row], ephemeral: true });
        const sent = await interaction.fetchReply();
        const filter = (i) => i.user.id === interaction.user.id && i.customId === 'transfer_select_name';
        const collector = await sent.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async (menu) => {
            await menu.deferUpdate();
            const name = menu.values[0];

            // จำนวนที่ยังไม่ถูกวางสำหรับชื่อนี้
            const entry = nameToCounts.get(name) || { total: 0, placed: 0 };
            const availableNow = Math.max(0, (entry.total || 0) - (entry.placed || 0));
            try { await interaction.editReply({ content: `พิมพ์จำนวนที่ต้องการโอน (1-${availableNow}) ภายใน 30 วินาที`, components: [] }); } catch {}

            const msgFilter = (m) => m.author && m.author.id === interaction.user.id;
            const msgCollector = interaction.channel.createMessageCollector({ filter: msgFilter, time: 30000 });
            let done = false;

            msgCollector.on('collect', async (m) => {
                const qty = parseInt((m.content || '').trim(), 10);
                // ลบข้อความของผู้ใช้เพื่อความสะอาด
                try { await m.delete().catch(() => {}); } catch {}
                if (!Number.isInteger(qty) || qty < 1 || qty > availableNow) {
                    try { await interaction.followUp({ content: `จำนวนไม่ถูกต้อง กรุณาพิมพ์ตัวเลข 1-${availableNow}`, ephemeral: true }); } catch {}
                    return;
                }
                if (done) return;
                done = true;
                msgCollector.stop();

                // ใช้ user lock แบบสองฝั่ง ด้วยการเรียง key เพื่อป้องกัน deadlock
                const [firstId, secondId] = [sender.id, receiver.id].sort();

                let session = null;
                try {
                    await withUserLock(guildId, firstId, async () => {
                        await withUserLock(guildId, secondId, async () => {
                            session = await mongoose.startSession();
                            await session.withTransaction(async () => {
                // โหลดโปรไฟล์ของผู้รับเพื่อเช็คความจุ
                const [senderInv, receiverInv, receiverProfile, senderHome] = await Promise.all([
                    GInv.findOne({ guild: guildId, user: sender.id }).session(session),
                    GInv.findOne({ guild: guildId, user: receiver.id }).session(session),
                    GProfile.findOneAndUpdate(
                        { guild: guildId, user: receiver.id },
                        { $setOnInsert: { level: 0, money: 0, tokens: 0, bank: 0, inventory: 100 } },
                        { upsert: true, new: true, session }
                    ),
                    GHome.findOne({ guild: guildId, user: sender.id }).session(session)
                ]);

                if (!senderInv || !Array.isArray(senderInv.item) || senderInv.item.length === 0) {
                    throw new Error("NO_ITEMS");
                }

                // คัดไอเทมที่ตรงตามเงื่อนไขจากผู้ส่ง
                const matchingIndexes = [];
                const targetNameLc = typeof name === 'string' ? name.toLowerCase() : '';
                for (let i = 0; i < senderInv.item.length; i++) {
                    const it = senderInv.item[i];
                    if (!it) continue;
                    if (it.type !== type) continue;
                    const itNameLc = typeof it.name === 'string' ? it.name.toLowerCase() : '';
                    if (itNameLc === targetNameLc) {
                        matchingIndexes.push(i);
                        if (matchingIndexes.length === qty) break;
                    }
                }

                if (matchingIndexes.length < qty) {
                    // คำนวณจำนวนที่ถูกวางอยู่ในบ้าน (placed)
                    let placedCount = 0;
                    if (senderHome && (type === 'floor' || type === 'tile' || type === 'furniture')) {
                        if (type === 'floor') {
                            const placed = senderHome.FLOOR_DATA && senderHome.FLOOR_DATA.FLOOR && typeof senderHome.FLOOR_DATA.FLOORI === 'string' && senderHome.FLOOR_DATA.FLOORI.toLowerCase() === targetNameLc;
                            placedCount = placed ? 1 : 0;
                        } else if (type === 'tile') {
                            const placed = senderHome.TILE_DATA && senderHome.TILE_DATA.TILE && typeof senderHome.TILE_DATA.TILEI === 'string' && senderHome.TILE_DATA.TILEI.toLowerCase() === targetNameLc;
                            placedCount = placed ? 1 : 0;
                        } else if (type === 'furniture') {
                            const sections = ['A_DATA','B_DATA','C_DATA','D_DATA'];
                            for (const sec of sections) {
                                const data = senderHome[sec];
                                if (!data) continue;
                                for (let i = 1; i <= 4; i++) {
                                    const flag = data[`${sec[0]}${i}`];
                                    const itemName = data[`${sec[0]}${i}I`];
                                    if (flag && typeof itemName === 'string' && itemName.toLowerCase() === targetNameLc) placedCount++;
                                }
                            }
                        }
                    }

                    const unplacedCount = matchingIndexes.length;
                    const totalOwnedApprox = unplacedCount + placedCount;
                    const needed = qty;
                    if (totalOwnedApprox >= needed && placedCount > 0) {
                        const needToRemove = needed - unplacedCount;
                        const availableNow = unplacedCount;
                        const err = new Error('ITEM_PLACED_NEEDS_UNPLACE');
                        err.meta = { availableNow, needToRemove };
                        throw err;
                    }

                    throw new Error("INSUFFICIENT_ITEMS");
                }

                // ตรวจสอบความจุผู้รับ
                const receiverItemCount = receiverInv && Array.isArray(receiverInv.item) ? receiverInv.item.length : 0;
                const needSlots = qty;
                if (receiverItemCount + needSlots > (receiverProfile?.inventory ?? 100)) {
                    throw new Error("RECEIVER_FULL");
                }

                // เตรียมเอกสาร inventory ของผู้รับถ้ายังไม่มี
                const receiverInventoryDoc = receiverInv || new GInv({ guild: guildId, user: receiver.id, item: [] });
                if (!Array.isArray(receiverInventoryDoc.item)) receiverInventoryDoc.item = [];

                // ดึงไอเทมตาม index (ต้องเรียงจากมากไปน้อยเพื่อ splice)
                matchingIndexes.sort((a, b) => b - a);
                const itemsToTransfer = [];
                const transferCount = qty;
                for (let k = 0; k < transferCount; k++) {
                    const idx = matchingIndexes[k];
                    if (typeof idx !== 'number') continue;
                    const [removed] = senderInv.item.splice(idx, 1);
                    if (removed) itemsToTransfer.push(removed);
                }

                // โอนให้ผู้รับ
                for (const it of itemsToTransfer) {
                    receiverInventoryDoc.item.push(it);
                }

                await Promise.all([
                    senderInv.save({ session }),
                    receiverInventoryDoc.save({ session })
                ]);
                // เก็บชื่อจริงของไอเทมที่ถูกโอนสำหรับแสดงผล
                interaction.__transferDisplayName = (itemsToTransfer[0] && itemsToTransfer[0].name) ? itemsToTransfer[0].name : name;
                        });
                    });
                });

                const embed = new EmbedBuilder()
                    .setColor(client.color)
                    .setDescription(`โอน \`${qty}x\` ${interaction.__transferDisplayName} (${type}) ให้ <@${receiver.id}> สำเร็จ!`);

                // แนบรูปไอเท็มเป็น thumbnail (รองรับ furniture/floor/tile)
                try {
                    if (type === 'furniture' || type === 'floor' || type === 'tile') {
                        const base = (process.env.ASSET_BASE_URL || 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main').replace(/\/$/, '');
                        const encodedName = encodeURIComponent(String(interaction.__transferDisplayName || ''));
                        const url = `${base}/${type}/${encodedName}.png`;
                        embed.setThumbnail(url);
                    }
                } catch {}
                try { await interaction.editReply({ content: "ทำรายการสำเร็จ", embeds: [embed], components: [] }); } catch {}
            } catch (err) {
                if (session) {
                    try { await session.abortTransaction(); } catch {}
                }
                let message = "เกิดข้อผิดพลาด ไม่สามารถโอนของได้";
                if (err && typeof err.message === 'string') {
                    if (err.message === "NO_ITEMS") message = "คุณไม่พบไอเทมในกระเป๋า";
                    else if (err.message === "INSUFFICIENT_ITEMS") message = "จำนวนไอเทมไม่เพียงพอ";
                    else if (err.message === "RECEIVER_FULL") message = "กระเป๋าของผู้รับเต็ม";
                    else if (err.message === 'ITEM_PLACED') message = "ไอเทมนี้กำลังถูกวางอยู่ในบ้าน กรุณาถอดของออกก่อน";
                    else if (err.message === 'ITEM_PLACED_NEEDS_UNPLACE') {
                        const availableNow2 = err.meta && typeof err.meta.availableNow === 'number' ? err.meta.availableNow : 0;
                        const needToRemove2 = err.meta && typeof err.meta.needToRemove === 'number' ? err.meta.needToRemove : 1;
                        message = `โอนได้ตอนนี้เพียง ${availableNow2} ชิ้น เนื่องจากมีของถูกวางอยู่ กรุณาถอดอย่างน้อย ${needToRemove2} ชิ้นออกจากบ้านก่อน`;
                    }
                }
                try { await interaction.editReply({ content: message, components: [] }); } catch {}
            } finally {
                if (session) {
                    try { await session.endSession(); } catch {}
                }
            }
            });

            msgCollector.on('end', async (collected) => {
                if (!done) {
                    try { await interaction.editReply({ content: 'หมดเวลา กรุณาใช้คำสั่งอีกครั้ง', components: [] }); } catch {}
                }
            });
        });

        collector.on('end', async () => {
            try { await interaction.editReply({ components: [] }); } catch {}
        });
    }
};


