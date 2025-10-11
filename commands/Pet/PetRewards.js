const { EmbedBuilder, ApplicationCommandOptionType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const GPet = require("../../settings/models/pet.js");
const GProfile = require("../../settings/models/profile.js");

// กำหนดรางวัลแต่ละระดับ (5, 10, 15, ..., 100)
const REWARD_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

// ฟังก์ชันกำหนดรางวัลแต่ละระดับ
// - เลเวลลงท้ายด้วย 5 (5, 15, 25, ...) ได้ 5,000 เหรียญ
// - เลเวลลงท้ายด้วย 0 (10, 20, 30, ...) ได้ 10,000 เหรียญ + 250 tokens
function getRewardForLevel(level) {
    const lastDigit = level % 10;
    
    // เช็คหลักสุดท้าย
    const money = (lastDigit === 0) ? 10000 : 5000; // ลงท้าย 0 ได้ 10K, ลงท้าย 5 ได้ 5K
    const tokens = (lastDigit === 0) ? 250 : 0; // ได้ token เฉพาะเลเวลลงท้ายด้วย 0
    
    let description = `<:706219192923455549:1312400668056748032> ${money.toLocaleString('th-TH')} เหรียญ`;
    if (tokens > 0) {
        description += ` + 🎫 ${tokens} โทเค็น`;
    }
    
    return {
        money: money,
        tokens: tokens,
        description: description
    };
}

// สร้าง embed สำหรับแสดงรางวัล
function createRewardEmbed(pet, currentPage, totalPages) {
    const level = REWARD_LEVELS[currentPage];
    const reward = getRewardForLevel(level);
    const isClaimed = pet.claimedRewards.includes(level);
    const canClaim = pet.level >= level && !isClaimed;
    
    let statusEmoji = "";
    let statusText = "";
    
    if (isClaimed) {
        statusEmoji = "✅";
        statusText = "รับรางวัลแล้ว";
    } else if (canClaim) {
        statusEmoji = "🎁";
        statusText = "พร้อมรับรางวัล!";
    } else {
        statusEmoji = "🔒";
        statusText = `ต้องการเลเวล ${level}`;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`${statusEmoji} รางวัลระดับ ${level}`)
        .setDescription(`**รางวัล:**\n${reward.description}`)
        .addFields(
            { name: "สถานะ", value: statusText, inline: true },
            { name: "เลเวลปัจจุบัน", value: `${pet.level}`, inline: true },
            { name: "ชื่อสัตว์เลี้ยง", value: pet.name || "Unnamed Pet", inline: true }
        )
        .setColor(isClaimed ? "#808080" : canClaim ? "#90d47b" : "#d45b5b")
        .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/rew.png")
        .setFooter({ text: `หน้า ${currentPage + 1}/${totalPages} • ใช้ปุ่มด้านล่างเพื่อดูรางวัลอื่น` })
    
    return embed;
}

// สร้างปุ่มสำหรับ navigation และการรับรางวัล
function createButtons(pet, currentPage, totalPages) {
    const level = REWARD_LEVELS[currentPage];
    const isClaimed = pet.claimedRewards.includes(level);
    const canClaim = pet.level >= level && !isClaimed;
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`reward_prev_${currentPage}`)
                .setLabel("◀ ก่อนหน้า")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`reward_claim_${level}`)
                .setLabel(isClaimed ? "รับแล้ว" : "รับรางวัล")
                .setStyle(isClaimed ? ButtonStyle.Success : canClaim ? ButtonStyle.Primary : ButtonStyle.Danger)
                .setDisabled(!canClaim || isClaimed)
                .setEmoji(isClaimed ? "✅" : canClaim ? "🎁" : "🔒"),
            new ButtonBuilder()
                .setCustomId(`reward_next_${currentPage}`)
                .setLabel("ถัดไป ▶")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1)
        );
    
    return row;
}

module.exports = {
    name: "รางวัลสัตว์เลี้ยง",
    description: "ดูและรับรางวัลตามระดับของสัตว์เลี้ยง",
    category: "Pet",
    options: [],
    
    run: async (client, interaction) => {
        try {
            const { user, guild } = interaction;
            
            // ตรวจสอบว่ามีสัตว์เลี้ยงหรือไม่
            const pet = await GPet.findOne({ guild: guild.id, user: user.id });
            if (!pet) {
                return interaction.reply({
                    content: "❌ คุณยังไม่มีสัตว์เลี้ยง! ใช้คำสั่ง `/รับสัตว์เลี้ยง` เพื่อรับสัตว์เลี้ยงตัวแรก",
                    ephemeral: true
                });
            }
            
            // สร้างหน้าแรก (หน้า 0)
            const currentPage = 0;
            const totalPages = REWARD_LEVELS.length;
            
            const embed = createRewardEmbed(pet, currentPage, totalPages);
            const buttons = createButtons(pet, currentPage, totalPages);
            
            const message = await interaction.reply({
                embeds: [embed],
                components: [buttons],
                ephemeral: true,
                fetchReply: true
            });
            
            // สร้าง collector สำหรับรับ interaction จากปุ่ม
            const collector = message.createMessageComponentCollector({
                filter: (i) => i.user.id === user.id,
                time: 300000 // 5 นาที
            });
            
            collector.on('collect', async (i) => {
                try {
                    const [action, type, value] = i.customId.split('_');
                    
                    if (action !== 'reward') return;
                    
                    // โหลดข้อมูล pet ล่าสุด
                    const updatedPet = await GPet.findOne({ guild: guild.id, user: user.id });
                    if (!updatedPet) {
                        return i.update({
                            content: "❌ ไม่พบข้อมูลสัตว์เลี้ยง",
                            embeds: [],
                            components: [],
                            ephemeral: true
                        });
                    }
                    
                    if (type === 'prev') {
                        const newPage = Math.max(0, parseInt(value) - 1);
                        const newEmbed = createRewardEmbed(updatedPet, newPage, totalPages);
                        const newButtons = createButtons(updatedPet, newPage, totalPages);
                        
                        await i.update({
                            embeds: [newEmbed],
                            components: [newButtons]
                        });
                    } else if (type === 'next') {
                        const newPage = Math.min(totalPages - 1, parseInt(value) + 1);
                        const newEmbed = createRewardEmbed(updatedPet, newPage, totalPages);
                        const newButtons = createButtons(updatedPet, newPage, totalPages);
                        
                        await i.update({
                            embeds: [newEmbed],
                            components: [newButtons]
                        });
                    } else if (type === 'claim') {
                        const rewardLevel = parseInt(value);
                        
                        // ตรวจสอบว่ารับรางวัลไปแล้วหรือยัง
                        if (updatedPet.claimedRewards.includes(rewardLevel)) {
                            return i.reply({
                                content: "❌ คุณรับรางวัลนี้ไปแล้ว!",
                                ephemeral: true
                            });
                        }
                        
                        // ตรวจสอบว่าระดับถึงหรือยัง
                        if (updatedPet.level < rewardLevel) {
                            return i.reply({
                                content: `❌ สัตว์เลี้ยงของคุณต้องอยู่ในระดับ ${rewardLevel} หรือสูงกว่า!`,
                                ephemeral: true
                            });
                        }
                        
                        // รับรางวัล
                        const reward = getRewardForLevel(rewardLevel);
                        
                        // อัพเดทโปรไฟล์ผู้เล่น
                        let profile = await GProfile.findOne({ guild: guild.id, user: user.id });
                        if (!profile) {
                            await client.createProfile(guild.id, user.id);
                            profile = await GProfile.findOne({ guild: guild.id, user: user.id });
                        }
                        
                        profile.money = (profile.money || 0) + reward.money;
                        if (reward.tokens > 0) {
                            profile.tokens = (profile.tokens || 0) + reward.tokens;
                        }
                        await profile.save();
                        
                        // อัพเดทข้อมูล pet
                        updatedPet.claimedRewards.push(rewardLevel);
                        await updatedPet.save();
                        
                        // ส่งข้อความยืนยัน
                        await i.reply({
                            content: `🎉 **รับรางวัลระดับ ${rewardLevel} สำเร็จ!**\n\n${reward.description}\n\nตรวจสอบยอดเงินของคุณได้ที่โปรไฟล์`,
                            ephemeral: true
                        });
                        
                        // อัพเดท embed ให้แสดงสถานะล่าสุด
                        const currentPageIndex = REWARD_LEVELS.indexOf(rewardLevel);
                        const newEmbed = createRewardEmbed(updatedPet, currentPageIndex, totalPages);
                        const newButtons = createButtons(updatedPet, currentPageIndex, totalPages);
                        
                        await i.message.edit({
                            embeds: [newEmbed],
                            components: [newButtons]
                        });
                    }
                } catch (err) {
                    console.error("Error handling reward button:", err);
                    if (!i.replied && !i.deferred) {
                        await i.reply({
                            content: "❌ เกิดข้อผิดพลาดในการดำเนินการ",
                            ephemeral: true
                        });
                    }
                }
            });
            
            collector.on('end', async () => {
                try {
                    // ปิดการใช้งานปุ่มเมื่อหมดเวลา
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('disabled_prev')
                                .setLabel("◀ ก่อนหน้า")
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('disabled_claim')
                                .setLabel("รับรางวัล")
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('disabled_next')
                                .setLabel("ถัดไป ▶")
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );
                    
                    await message.edit({
                        components: [disabledRow]
                    }).catch(() => {});
                } catch (err) {
                    console.error("Error disabling buttons:", err);
                }
            });
            
        } catch (error) {
            console.error("Error in petrewards command:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ เกิดข้อผิดพลาดในการดำเนินการ",
                    ephemeral: true
                });
            }
        }
    }
};
