const { EmbedBuilder, ApplicationCommandOptionType, AttachmentBuilder } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const { GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const GProfile = require("../../settings/models/profile.js");
const GPet = require("../../settings/models/pet.js");

// ลงทะเบียนฟอนต์ Gotham Rounded SSm Light
const DEFAULT_FONT_FAMILY = "Gotham Rnd SSm";
const REMOTE_FONT_URL = "https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/gothamrndssm_light.otf";

async function registerRemoteFont() {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2500);
    try {
        const res = await fetch(REMOTE_FONT_URL, { signal: controller.signal });
        if (!res.ok) throw new Error(`font http ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        GlobalFonts.registerFromBuffer(buf, DEFAULT_FONT_FAMILY);
        return true;
    } catch (_) {
        return false;
    } finally {
        clearTimeout(id);
    }
}

(async () => {
    const ok = await registerRemoteFont();
    if (!ok) {
        try {
            GlobalFonts.registerFromPath(path.resolve("./assests/fonts/gothamrndssm_light.otf"), DEFAULT_FONT_FAMILY);
        } catch (_) {
            // ignore if not found; will fallback to platform fonts
        }
    }
})();

// ค่าคงที่สำหรับการ์ด
const CARD_WIDTH = 800;
const CARD_HEIGHT = 600;
const CARD_RADIUS = 24;
const RENDER_CONCURRENCY_MAX = 4;
let activeRenders = 0;

// แคชสำหรับรูปโปรไฟล์
const AVATAR_CACHE_MAX = 256;
const AVATAR_CACHE_TTL_MS = 5 * 60 * 1000;
const avatarCache = new Map();

// ฟังก์ชันสำหรับโหลดรูปโปรไฟล์
async function getAvatarImage(user) {
    const url = user.displayAvatarURL({ extension: 'png', size: 64 });
    const now = Date.now();
    const cached = avatarCache.get(url);
    if (cached && (now - cached.ts) < AVATAR_CACHE_TTL_MS) {
        return cached.image;
    }
    const image = await Canvas.loadImage(url);
    avatarCache.set(url, { ts: now, image });
    if (avatarCache.size > AVATAR_CACHE_MAX) {
        // ลบแคชเก่าออก
        const oldestKey = Array.from(avatarCache.keys())[0];
        avatarCache.delete(oldestKey);
    }
    return image;
}

// ฟังก์ชันสำหรับสร้างพื้นหลังการ์ด
function createBackgroundCanvas() {
    const canvas = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = canvas.getContext("2d");

    // สร้างพื้นหลัง gradient
    const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");

    ctx.save();
    roundedRectPath(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
    ctx.clip();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // เพิ่มลวดลาย
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#ffffff";
    drawPattern(ctx);
    ctx.globalAlpha = 1;

    ctx.restore();
    return canvas;
}

// ฟังก์ชันสำหรับวาดลวดลาย
function drawPattern(ctx) {
    // วาดวงกลมแบบสุ่ม
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * CARD_WIDTH;
        const y = Math.random() * CARD_HEIGHT;
        const radius = Math.random() * 50 + 10;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ฟังก์ชันสำหรับสร้าง rounded rectangle path
function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// ฟังก์ชันสำหรับจัดรูปแบบตัวเลข
function formatNumber(n) {
    try {
        return n.toLocaleString("en-US");
    } catch {
        return `${n}`;
    }
}

// ฟังก์ชันสำหรับดึงข้อมูลลีดเดอร์บอร์ดตามประเภท
async function getLeaderboardData(guildId, type) {
    switch (type) {
        case 'money':
            return await GProfile.find({ guild: guildId })
                .sort({ money: -1 })
                .limit(10)
                .lean();
        
        case 'bank':
            return await GProfile.find({ guild: guildId })
                .sort({ bank: -1 })
                .limit(10)
                .lean();
        
        case 'level':
            return await GPet.find({ guild: guildId })
                .sort({ level: -1, exp: -1 })
                .limit(10)
                .lean();
        
        case 'firestreak':
            return await GPet.find({ guild: guildId })
                .sort({ fireStreak: -1 })
                .limit(10)
                .lean();
        
        default:
            return [];
    }
}

// ฟังก์ชันสำหรับวาดสัญลักษณ์อันดับ
function drawRankSymbol(ctx, rank, x, y) {
    const rankColors = {
        1: '#FFD700', // ทอง
        2: '#C0C0C0', // เงิน
        3: '#CD7F32'  // ทองแดง
    };
    
    const color = rankColors[rank] || '#ffffff';
    
    if (rank <= 3) {
        // วาดวงกลมสำหรับอันดับ 1-3
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(x, y - 10, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // วาดตัวเลขในวงกลม
        ctx.fillStyle = '#000000';
        ctx.font = "bold 16px 'Gotham Rnd SSm'";
        ctx.textAlign = 'center';
        ctx.fillText(rank, x, y - 5);
        ctx.restore();
    }
}

// ฟังก์ชันสำหรับวาดอันดับ
async function drawRanking(ctx, rank, user, value, type, x, y) {
    const rankColors = {
        1: '#FFD700', // ทอง
        2: '#C0C0C0', // เงิน
        3: '#CD7F32'  // ทองแดง
    };

    // วาดสัญลักษณ์อันดับด้านหน้าสุด
    if (rank <= 3) {
        drawRankSymbol(ctx, rank, x + -10, y + 20);
    }

    // วาดอันดับ
    ctx.font = "bold 24px 'Gotham Rnd SSm'";
    ctx.fillStyle = rankColors[rank] || '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`#${rank}`, x + 30, y + 20);

    // วาดรูปโปรไฟล์
    try {
        const avatar = await getAvatarImage(user);
        const avatarSize = 40;
        const avatarX = x + 80;
        const avatarY = y - 5;
        
        // วาดวงกลมสำหรับรูปโปรไฟล์
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        
        // วาดขอบวงกลม
        ctx.strokeStyle = rankColors[rank] || '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
        ctx.stroke();
    } catch (error) {
        console.error('Error drawing avatar:', error);
    }

    // วาดชื่อผู้ใช้
    ctx.font = "bold 18px 'Gotham Rnd SSm'";
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(user.username, x + 140, y + 15);

    // วาดค่า
    ctx.font = "16px 'Gotham Rnd SSm'";
    ctx.fillStyle = '#b0b0b0';
    let displayValue = '';
    
    switch (type) {
        case 'money':
            displayValue = `${formatNumber(value)} Bath`;
            break;
        case 'bank':
            displayValue = `${formatNumber(value)} Bath`;
            break;
        case 'level':
            displayValue = `Level ${value}`;
            break;
        case 'firestreak':
            displayValue = `${value}`;
            break;
    }
    
    ctx.fillText(displayValue, x + 140, y + 35);
}

module.exports = {
    name: ["ลีดเดอร์บอร์ด"],
    description: "แสดงลีดเดอร์บอร์ดอันดับต่างๆ",
    category: "General",
    options: [
        {
            name: "หมวดหมู่",
            description: "ประเภทของลีดเดอร์บอร์ด",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: "เงินในกระเป๋า", value: "money" },
                { name: "เงินในธนาคาร", value: "bank" },
                { name: "เลเวลสัตว์เลี้ยง", value: "level" },
                { name: "เติมไฟ", value: "firestreak" }
            ]
        }
    ],
    run: async (client, interaction) => {
        const type = interaction.options.getString("หมวดหมู่");
        
        await interaction.deferReply();

        // หากโหลดสูงเกินกำหนด ให้ fallback เป็น embed
        if (activeRenders >= RENDER_CONCURRENCY_MAX) {
            const data = await getLeaderboardData(interaction.guild.id, type);
            const embed = createFallbackEmbed(data, type, client);
            return interaction.editReply({ embeds: [embed] });
        }

        activeRenders++;
        try {
            const data = await getLeaderboardData(interaction.guild.id, type);
            
            if (data.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle("📊 ลีดเดอร์บอร์ด")
                    .setDescription("ไม่พบข้อมูลในระบบ")
                    .setColor(client.color)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();
                return interaction.editReply({ embeds: [embed] });
            }

            const canvas = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT);
            const ctx = canvas.getContext("2d");

            // วาดพื้นหลัง
            const bgCanvas = createBackgroundCanvas();
            ctx.drawImage(bgCanvas, 0, 0);

            // วาดหัวข้อ
            ctx.font = "bold 32px 'Gotham Rnd SSm'";
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            
            let title = '';
            switch (type) {
                case 'money':
                    title = 'Wallet Money Leaderboard';
                    break;
                case 'bank':
                    title = 'Bank Money Leaderboard';
                    break;
                case 'level':
                    title = 'Pet Level Leaderboard';
                    break;
                case 'firestreak':
                    title = 'Fire Streak Leaderboard';
                    break;
            }
            
            ctx.fillText(title, CARD_WIDTH / 2, 60);

            // วาดอันดับ
            const startY = 120;
            const rowHeight = 60;
            
            for (let i = 0; i < Math.min(data.length, 8); i++) {
                const item = data[i];
                const user = await client.users.fetch(item.user).catch(() => null);
                
                if (user) {
                    const y = startY + (i * rowHeight);
                    let value = 0;
                    
                    switch (type) {
                        case 'money':
                            value = item.money || 0;
                            break;
                        case 'bank':
                            value = item.bank || 0;
                            break;
                        case 'level':
                            value = item.level || 1;
                            break;
                        case 'firestreak':
                            value = item.fireStreak || 0;
                            break;
                    }
                    
                    await drawRanking(ctx, i + 1, user, value, type, 50, y);
                }
            }

            // แปลงเป็น PNG และส่ง
            const png = await canvas.encode("png");
            const file = new AttachmentBuilder(png, { name: `leaderboard_${type}.png` });
            
            let thaiTitle = '';
            switch (type) {
                case 'money':
                    thaiTitle = 'เงินในกระเป๋า';
                    break;
                case 'bank':
                    thaiTitle = 'เงินในธนาคาร';
                    break;
                case 'level':
                    thaiTitle = 'เลเวลสัตว์เลี้ยง';
                    break;
                case 'firestreak':
                    thaiTitle = 'เติมไฟ';
                    break;
            }
            
            const contentText = `> **แสดงลีดเดอร์บอร์ด • ${thaiTitle}**`;
            return interaction.editReply({ content: contentText, files: [file] });

        } catch (error) {
            console.error('Error creating leaderboard:', error);
            
            // Fallback เป็น embed
            const data = await getLeaderboardData(interaction.guild.id, type);
            const embed = createFallbackEmbed(data, type, client);
            return interaction.editReply({ embeds: [embed] });
        } finally {
            activeRenders = Math.max(0, activeRenders - 1);
        }
    }
};

// ฟังก์ชันสำหรับสร้าง embed fallback
function createFallbackEmbed(data, type, client) {
    const embed = new EmbedBuilder()
        .setTitle("📊 ลีดเดอร์บอร์ด")
        .setColor(client.color)
        .setFooter({ text: `Requested By: ${client.user.tag}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    let title = '';
    switch (type) {
        case 'money':
            title = '💰 เงินในกระเป๋า';
            break;
        case 'bank':
            title = '🏦 เงินในธนาคาร';
            break;
        case 'level':
            title = '🎯 ระดับสัตว์เลี้ยง';
            break;
        case 'firestreak':
            title = '🔥 Fire Streak';
            break;
    }
    
    embed.setDescription(`**${title}**\n\n`);

    if (data.length === 0) {
        embed.addFields({ name: "ไม่พบข้อมูล", value: "ยังไม่มีข้อมูลในระบบ", inline: false });
    } else {
        let description = '';
        for (let i = 0; i < Math.min(data.length, 10); i++) {
            const item = data[i];
            const rank = i + 1;
            const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🔸';
            
            let value = '';
            switch (type) {
                case 'money':
                    value = `${formatNumber(item.money || 0)} บาท`;
                    break;
                case 'bank':
                    value = `${formatNumber(item.bank || 0)} บาท`;
                    break;
                case 'level':
                    value = `Level ${item.level || 1}`;
                    break;
                case 'firestreak':
                    value = `${item.fireStreak || 0} 🔥`;
                    break;
            }
            
            description += `${rankEmoji} **#${rank}** <@${item.user}> - ${value}\n`;
        }
        
        embed.setDescription(description);
    }

    return embed;
}
