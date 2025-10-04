const { EmbedBuilder, ApplicationCommandOptionType, AttachmentBuilder } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const { GlobalFonts } = require("@napi-rs/canvas");
const path = require("path");
const GProfile = require("../../settings/models/profile.js");

// ลงทะเบียนฟอนต์ Gotham Rounded SSm Light
try {
    GlobalFonts.registerFromPath(path.resolve("./assests/fonts/gothamrndssm_light.otf"), "Gotham Rnd SSm");
} catch (_) {
    // ignore if not found; will fallback to platform fonts
}

// เพิ่ม: ค่าคงที่และแคชสำหรับเร่งความเร็วภายใต้โหลดสูง
const CARD_WIDTH = 600;
const CARD_HEIGHT = 300;
const CARD_RADIUS = 24;

const AVATAR_CACHE_MAX = 256; // จำกัดจำนวนผู้ใช้ที่แคชรูปโปรไฟล์
const AVATAR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 นาที
const avatarCache = new Map(); // key: url, value: { ts: number, image: Image }

const RENDER_CONCURRENCY_MAX = 4; // จำกัดจำนวนการเรนเดอร์พร้อมกัน
let activeRenders = 0;

const bgState = {
    customBgImage: null,              // Image ที่โหลดจาก URL (ถ้าสำเร็จ)
    preRenderedCustomBg: null,        // Canvas ของพื้นหลังแบบ custom ที่วาดโค้งแล้ว
    preRenderedFallback: null         // Canvas ของพื้นหลัง fallback (gradient + ของตกแต่ง)
};

// โหลดและพรีเรนเดอร์พื้นหลังล่วงหน้า (รันครั้งเดียวตอนโหลดไฟล์)
(async function preloadBackgrounds() {
    try {
        const img = await Canvas.loadImage("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/wallet/card_bg.png");
        bgState.customBgImage = img;
        bgState.preRenderedCustomBg = buildCustomBackgroundCanvas(img);
    } catch (_) {
        // ถ้าโหลด custom ไม่ได้ จะใช้ fallback ซึ่งจะสร้างด้านล่าง
    }
    // สร้างพื้นหลัง fallback เสมอ (เผื่อ custom ล้มเหลว หรือใช้เป็นดีฟอลต์)
    bgState.preRenderedFallback = buildFallbackBackgroundCanvas();
})();

function loadImageWithTimeout(url, timeoutMs) {
    return Promise.race([
        Canvas.loadImage(url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('image-timeout')), timeoutMs))
    ]);
}

async function getAvatarImage(user) {
    const url = user.displayAvatarURL({ extension: 'png', size: 64 });
    const now = Date.now();
    const cached = avatarCache.get(url);
    if (cached && (now - cached.ts) < AVATAR_CACHE_TTL_MS) {
        return cached.image;
    }
    const image = await loadImageWithTimeout(url, 1200);
    avatarCache.set(url, { ts: now, image });
    if (avatarCache.size > AVATAR_CACHE_MAX) pruneOldestFromAvatarCache();
    return image;
}

function pruneOldestFromAvatarCache() {
    let oldestKey = null;
    let oldestTs = Infinity;
    for (const [key, value] of avatarCache.entries()) {
        if (value.ts < oldestTs) {
            oldestTs = value.ts;
            oldestKey = key;
        }
    }
    if (oldestKey) avatarCache.delete(oldestKey);
}

function buildCustomBackgroundCanvas(image) {
    const c = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = c.getContext("2d");
    ctx.save();
    roundedRectPath(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
    ctx.clip();
    ctx.drawImage(image, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    ctx.restore();
    return c;
}

function buildFallbackBackgroundCanvas() {
    const c = Canvas.createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = c.getContext("2d");

    ctx.save();
    roundedRectPath(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS);
    ctx.clip();

    // ฉากหลัง gradient เฉพาะในพื้นที่การ์ด
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    grad.addColorStop(0, "#0b7bd4");
    grad.addColorStop(1, "#0062c8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // ลวดลายโค้งทับชั้นบางๆ
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#ffffff";
    drawArcWave(ctx, CARD_WIDTH * 0.2, -60, CARD_WIDTH * 0.9, 180);
    drawArcWave(ctx, -40, -30, CARD_WIDTH * 0.9, 120);
    ctx.globalAlpha = 1;

    // หัวการ์ดซ้ายบน + ขวาบน
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 44px 'Gotham Rnd SSm'";
    ctx.fillText("wallet.", 44, 72);
    ctx.font = "500 26px 'Gotham Rnd SSm'";
    ctx.textAlign = "right";
    ctx.fillText("standard", CARD_WIDTH - 40, 64);
    ctx.textAlign = "left";

    // ชิปการ์ด + จุดล่างขวา
    drawCardChip(ctx, CARD_WIDTH - 200, 110, 120, 72);
    drawDots(ctx, CARD_WIDTH - 160, CARD_HEIGHT - 36);

    ctx.restore();
    return c;
}

module.exports = {
    name: ["เป๋าตัง"],
    description: "ดูเงินในกระเป๋าและธนาคารของคุณ",
    category: "Economy",
    options: [],
    run: async (client, interaction) => {
        const user = interaction.user;
        const profile = await GProfile.findOne({ guild: interaction.guild.id, user: user.id })
            .select("money tokens bank")
            .lean();
        if (!profile) {
            return interaction.reply({ content: `ไม่พบข้อมูลของคุณ`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: false });

        // ข้อความ content ตามที่ต้องการ
        const displayNameText = user.username;
        const contentText = `> ** แสดงกระเป๋าตังของ • [** ${displayNameText} ** ]**`;

        // หากโหลดสูงเกินกำหนด ให้ fallback เป็น embed เพื่อรักษา latency ของบอท
        if (activeRenders >= RENDER_CONCURRENCY_MAX) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: `${user.username}`, iconURL: user.displayAvatarURL() })
                .setTitle(`ยอดเงินของคุณ`)
                .addFields(
                    { name: "เงินในกระเป๋า", value: `${formatNumber(profile.money || 0)} <:706219192923455549:1312400668056748032>`, inline: true },
                    { name: "โทเคน", value: `${formatNumber(profile.tokens || 0)} 🪙`, inline: true },
                    { name: "เงินในธนาคาร", value: `${formatNumber(profile.bank || 0)} 🏦`, inline: true }
                )
                .setColor(client.color)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();
            return interaction.editReply({ content: contentText, embeds: [embed] });
        }

        activeRenders++;
        try {
            const width = CARD_WIDTH, height = CARD_HEIGHT;
            const canvas = Canvas.createCanvas(width, height);
            const ctx = canvas.getContext("2d");

            // ใช้พื้นหลังที่พรีเรนเดอร์ไว้ (custom ถ้ามี, ไม่งั้น fallback)
            const hasCustomBg = Boolean(bgState.preRenderedCustomBg);
            if (hasCustomBg) {
                ctx.drawImage(bgState.preRenderedCustomBg, 0, 0);
            } else {
                ctx.drawImage(bgState.preRenderedFallback, 0, 0);
            }

            // ตำแหน่งข้อความให้ตรงกับไอคอนบนพื้นหลัง (ขยับเข้าใกล้ไอคอนมากขึ้น)
            const textX = hasCustomBg ? 82 : 44;
            const baseY = hasCustomBg ? 126 : 118;
            const gap = 44;

            // คลิปให้องค์ประกอบทั้งหมดอยู่ภายในการ์ด เพื่อรักษามุมโปร่งใสของ PNG
            ctx.save();
            roundedRectPath(ctx, 0, 0, width, height, CARD_RADIUS);
            ctx.clip();

            // แสดงยอดเงิน 3 แถว
            drawRow(ctx, textX, baseY, "", `${formatNumber(profile.money || 0)} Bath`, hasCustomBg);
            drawRow(ctx, textX, baseY + gap, "", `${formatNumber(profile.tokens || 0)} Tokens`, hasCustomBg);
            drawRow(ctx, textX, baseY + gap * 2, "", `${formatNumber(profile.bank || 0)} Bank`, hasCustomBg);

            // ชื่อผู้ใช้ + รูปโปรไฟล์ทรงกลมด้านหน้า
            const displayName = user.username;
            ctx.font = "600 18px 'Gotham Rnd SSm'";
            ctx.fillStyle = "#ffffff";
            const nameY = hasCustomBg ? (baseY + gap * 3 + 8) : (baseY + gap * 3 + 0);

            try {
                const avatarImg = await getAvatarImage(user);
                const avatarSize = 32;
                const nameX = textX;
                const avatarX = nameX - avatarSize - 10;
                const avatarY = nameY - avatarSize + 6;
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();
                setTextShadow(ctx);
                ctx.fillText(displayName, nameX, nameY);
                resetTextShadow(ctx);
            } catch {
                setTextShadow(ctx);
                ctx.fillText(displayName, textX, nameY);
                resetTextShadow(ctx);
            }

            ctx.restore();

            const png = await canvas.encode("png");
            const file = new AttachmentBuilder(png, { name: `balance.png` });
            return interaction.editReply({ content: contentText, files: [file] });
        } catch (err) {
            // fallback เป็น embed เดิม (แสดงชื่ออย่างเดียว ไม่รวม tag)
            const embed = new EmbedBuilder()
                .setAuthor({ name: `${user.username}`, iconURL: user.displayAvatarURL() })
                .setTitle(`ยอดเงินของคุณ`)
                .addFields(
                    { name: "เงินในกระเป๋า", value: `${formatNumber(profile.money || 0)} <:706219192923455549:1312400668056748032>`, inline: true },
                    { name: "โทเคน", value: `${formatNumber(profile.tokens || 0)} 🪙`, inline: true },
                    { name: "เงินในธนาคาร", value: `${formatNumber(profile.bank || 0)} 🏦`, inline: true }
                )
                .setColor(client.color)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();
            return interaction.editReply({ content: contentText, embeds: [embed] });
        } finally {
            activeRenders = Math.max(0, activeRenders - 1);
        }
    }
};

function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawArcWave(ctx, cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, Math.PI / 8, 0, Math.PI * 2);
    ctx.fill();
}

function drawCardChip(ctx, x, y, w, h) {
    ctx.save();
    // ฐานชิป
    ctx.fillStyle = "#e9e9ea";
    roundedRectPath(ctx, x, y, w, h, 12);
    ctx.fill();

    // เส้นแนวนอน
    ctx.strokeStyle = "#c5c5c7";
    ctx.lineWidth = 2;
    const rows = 4;
    for (let i = 1; i < rows; i++) {
        const yy = y + (h / rows) * i;
        ctx.beginPath();
        ctx.moveTo(x + 8, yy);
        ctx.lineTo(x + w - 8, yy);
        ctx.stroke();
    }
    // ร่องกลาง
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 8);
    ctx.lineTo(x + w / 2, y + h - 8);
    ctx.stroke();
    ctx.restore();
}

function drawDots(ctx, startX, y) {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * 28, y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function setTextShadow(ctx) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
}

function resetTextShadow(ctx) {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
}

function drawRow(ctx, x, y, emoji, text, isBg) {
    ctx.fillStyle = "#ffffff";
    if (emoji) {
        ctx.font = "28px 'Gotham Rnd SSm'";
        setTextShadow(ctx);
        ctx.fillText(emoji, x, y);
        resetTextShadow(ctx);
    }
    ctx.font = isBg ? "500 18px 'Gotham Rnd SSm'" : "500 18px 'Gotham Rnd SSm'";
    setTextShadow(ctx);
    ctx.fillText(text, x + (emoji ? 36 : 0), y);
    resetTextShadow(ctx);
}

function formatNumber(n) {
    try {
        return n.toLocaleString("en-US");
    } catch {
        return `${n}`;
    }
} 