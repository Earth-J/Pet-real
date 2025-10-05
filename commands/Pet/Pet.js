const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const GPet = require("../../settings/models/pet.js");
const Canvas = require("@napi-rs/canvas");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const GIFEncoder = require("gif-encoder-2");
const { getRenderQueue } = require("../../structures/services/renderQueueSingleton");
const { fetchBuffer } = require("../../structures/services/discordUpload");
const { getEmotionKey } = require("../../structures/services/petEmotion");
const { getPoseKey } = require("../../structures/services/petPose");
const { calculateHealth, getHealthStatus, needsUrgentCare } = require("../../structures/services/petHealthSystem");
const { getFireStreakText } = require("../../handlers/FireStreakHandler");
// เพิ่ม import สำหรับบ้าน
const GHome = require("../../settings/models/house.js");
const { buildHouseLayers } = require("../../structures/services/layout");
const { buildCdnUrlFromLocal } = require("../../structures/utils/cdn");

// helper embeds
function buildInfoEmbed(description, color = '#e8f093', title) {
  const emb = new EmbedBuilder().setColor(color);
  if (title) emb.setTitle(title);
  if (description) emb.setDescription(description);
  return emb;
}

// ลงทะเบียนฟอนต์สำหรับการ์ด (รองรับไทย) จาก CDN พร้อม fallback เป็นไฟล์ภายในโปรเจกต์
let THAI_FONT_READY = false;
const STATUS_FONT_FAMILY = process.env.PET_STATUS_FONT_FAMILY || 'Gotham Rnd SSm';
const REMOTE_FONT_URL = 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/gothamrndssm_light.otf';
async function registerRemoteThaiFont() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(REMOTE_FONT_URL, { signal: controller.signal });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (Canvas.GlobalFonts && typeof Canvas.GlobalFonts.registerFromBuffer === 'function') {
      Canvas.GlobalFonts.registerFromBuffer(buf, STATUS_FONT_FAMILY);
    }
    THAI_FONT_READY = true;
    return true;
  } catch (_) {
    return false;
  } finally {
    clearTimeout(id);
  }
}
// พยายามลงทะเบียนจาก CDN เมื่อโหลดไฟล์ครั้งแรก
(async () => {
  try {
    if (!THAI_FONT_READY) {
      await registerRemoteThaiFont();
    }
  } catch (_) { /* ignore */ }
})();
function ensureThaiFontRegistered() {
  if (THAI_FONT_READY) return;
  try {
    const fontCandidates = [
      path.join(__dirname, '../../assests/fonts/gothamrndssm_light.otf'),
      path.join(process.cwd(), 'assests/fonts/gothamrndssm_light.otf'),
    ];
    for (const fp of fontCandidates) {
      if (fs.existsSync(fp)) {
        if (Canvas.GlobalFonts && typeof Canvas.GlobalFonts.registerFromPath === 'function') {
          Canvas.GlobalFonts.registerFromPath(fp, STATUS_FONT_FAMILY);
        } else if (typeof Canvas.registerFont === 'function') {
          Canvas.registerFont(fp, { family: STATUS_FONT_FAMILY });
        }
        THAI_FONT_READY = true;
        break;
      }
    }
  } catch (_) { /* ignore font errors */ }
}

// ปรับความเร็ว GIF ได้ผ่าน env PET_GIF_DELAY_MS (ms ต่อเฟรม), ค่าเริ่มต้น 210
const PET_GIF_DELAY_MS = parseInt(process.env.PET_GIF_DELAY_MS || '210');
const PET_RENDER_TIMEOUT_MS = parseInt(process.env.PET_RENDER_TIMEOUT_MS || '25000');
// ปิด local GIF เป็นค่าเริ่มต้นเพื่อรองรับ concurrent สูง (เปิดได้ผ่าน env)
const PET_LOCAL_GIF_MAX_CONCURRENCY = parseInt(process.env.PET_LOCAL_GIF_MAX_CONCURRENCY || '0');
// เพิ่ม TTL cache การ์ดเพื่อเพิ่มโอกาส cache hit ใน traffic สูง
const PET_CARD_TTL_MS = parseInt(process.env.PET_CARD_TTL_MS || '20000');
// ปรับคุณภาพ GIF ผ่าน ENV (ตัวเลขมาก = เร็วขึ้น คุณภาพลดลง ตาม gif-encoder-2)
const PET_GIF_QUALITY = parseInt(process.env.PET_GIF_QUALITY || '10');
const PET_HOUSE_GIF_QUALITY = parseInt(process.env.PET_HOUSE_GIF_QUALITY || '12');
// ขนาด cache รวม (รูป/data/card)
const PET_CACHE_MAX_ENTRIES = parseInt(process.env.PET_CACHE_MAX_ENTRIES || '500');
// เปิด/ปิดการแนบบ้าน (เรนเดอร์บ้านเป็นงานเบื้องหลัง)
const PET_INCLUDE_HOUSE = process.env.PET_INCLUDE_HOUSE !== '0';
// URL พื้นหลังบ้านเริ่มต้น (หากเลเยอร์พื้นหลังไม่ถูกส่งมา)
const PET_HOUSE_BG_URL = process.env.PET_HOUSE_BG_URL || 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/backgrounds/default.png';
// กำหนด key ของ room background (ให้ renderer สร้าง URL เป็น `${ASSET_BASE_URL}/backgrounds/{key}.png`)
const PET_HOUSE_BG_KEY = (process.env.PET_HOUSE_BG_KEY || '').trim();
// พื้นหลังแบบไฟล์โลคัล (ถ้ากำหนดจะใช้ไฟล์นี้ก่อนเสมอ)
const PET_HOUSE_BG_LOCAL_PATH = (process.env.PET_HOUSE_BG_LOCAL_PATH || path.join(__dirname, '../../assests/backgrounds/default.png')).trim();
// โดเมน CDN สำหรับ asset pet
const PET_ASSET_BASE_URL = (process.env.PET_ASSET_BASE_URL || 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main').replace(/\/$/, '');
// URL โปรไฟล์พื้นหลังการ์ด (ถ้ากำหนดจะใช้แทนไฟล์โลคัล)
const PET_PROFILE_BG_URL = process.env.PET_PROFILE_BG_URL || 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/pet/profile.png';
// กำหนด prefix ของ path บน CDN ได้ (เช่น 'assets' หรือ 'assests' หรือเว้นว่าง)
const PET_ASSET_PATH_PREFIX = (process.env.PET_ASSET_PATH_PREFIX || '').replace(/^\/+|\/+$/g, '');
// เปิดโหมดดีบัก
const PET_DEBUG = process.env.PET_DEBUG === '1';
function pdbg(tag, data) { if (PET_DEBUG) { try { console.log(`[PET_DEBUG] ${tag}`, data ?? ''); } catch(_){} } }

// จำนวนเฟรมดีฟอลต์สำหรับ CDN และหลักเลข 0-padding ของชื่อไฟล์
const PET_CDN_DEFAULT_FRAME_COUNT = parseInt(process.env.PET_CDN_DEFAULT_FRAME_COUNT || '16');
const PET_CDN_EMOTE_DEFAULT_FRAME_COUNT = parseInt(process.env.PET_CDN_EMOTE_DEFAULT_FRAME_COUNT || '16');
const PET_CDN_FRAME_PAD = parseInt(process.env.PET_CDN_FRAME_PAD || '3');

function buildCdnUrl(...segs) {
  const parts = [PET_ASSET_BASE_URL];
  if (PET_ASSET_PATH_PREFIX) parts.push(PET_ASSET_PATH_PREFIX);
  for (const s of segs) {
    const v = String(s || '').trim().replace(/^\/+|\/+$/g, '');
    if (v) parts.push(v);
  }
  return parts.join('/');
}
// ปรับให้รวมโฟลเดอร์ 'assests' ตามโครงสร้าง CDN จริง
function cdnPetStaticUrl(state, type) {
  return buildCdnUrl('pet', state, `${type}.png`);
}
function cdnPoseFrameUrl(poseKey, type, fileName) {
  return buildCdnUrl('pet', 'pose', poseKey, type, 'frames', fileName);
}
function cdnEmoteFrameUrl(state, fileName) {
  return buildCdnUrl('pet', 'emote', state, 'frames', fileName);
}

// helper: สร้างชื่อไฟล์เฟรมแบบเรียงลำดับจากจำนวนและหลัก 0-padding
function zeroPad(num, width) {
  return String(num).padStart(width, '0');
}
function makeSequentialFrameNames(count, pad, ext = 'png') {
  const c = Math.max(0, Number(count) || 0);
  const p = Math.max(0, Number(pad) || 0);
  return Array.from({ length: c }, (_, i) => `${zeroPad(i + 1, p)}.${ext}`);
}

// ค่าตำแหน่งเริ่มต้นของตัว pet และไอคอนอารมณ์บนหัว
const PET_DRAW_DEFAULT = {
  x: parseInt(process.env.PET_X || '20'),
  y: parseInt(process.env.PET_Y || '15'),
  w: parseInt(process.env.PET_W || '56'),
  h: parseInt(process.env.PET_H || '60'),
};
const EMOTE_DRAW_DEFAULT = { x: 10, y: 4, w: 32, h: 32 };
// วาด pet ในบ้าน (ผืน 300x300)
const HOUSE_TRANSPARENT_BG = process.env.HOUSE_TRANSPARENT_BG === '1';
const PET_INHOUSE_DRAW = {
  x: parseInt(process.env.PET_INHOUSE_X || '120'),
  y: parseInt(process.env.PET_INHOUSE_Y || '170'),
  w: parseInt(process.env.PET_INHOUSE_W || '74'),
  h: parseInt(process.env.PET_INHOUSE_H || '82'),
};
// ปรับตำแหน่ง anchor ของ pet ภายในสล็อต (แก้เคลื่อนขวาเล็กน้อย)
const PET_SLOT_ANCHOR_OFFSET_X = parseInt(process.env.PET_SLOT_ANCHOR_OFFSET_X || '-20');
const PET_SLOT_ANCHOR_OFFSET_Y = parseInt(process.env.PET_SLOT_ANCHOR_OFFSET_Y || '-5');
// ปรับขนาด emoji ในบ้าน (ค่าเริ่มต้นเล็กลง)
const PET_HOUSE_EMOTE_SIZE = parseInt(process.env.PET_HOUSE_EMOTE_SIZE || '28');
// ปรับ offset ของ emoji ในบ้านเทียบกับมุมซ้ายบนของ pet
const PET_HOUSE_EMOTE_OFFSET_X = parseInt(process.env.PET_HOUSE_EMOTE_OFFSET_X || '-5');
const PET_HOUSE_EMOTE_OFFSET_Y = parseInt(process.env.PET_HOUSE_EMOTE_OFFSET_Y || '-10');

// เส้นทางภาพพื้นหลังโปรไฟล์ (โหลดครั้งเดียว)
const PROFILE_CDN_URL = buildCdnUrlFromLocal('assests/pet/profile.png');
const PROFILE_IMG_PROMISE = (async () => {
  try {
    const url = (PET_PROFILE_BG_URL && PET_PROFILE_BG_URL.trim()) || PROFILE_CDN_URL;
    return await Canvas.loadImage(url);
  } catch { return null; }
})();

// Simple in-memory TTL cache with max entries (LRU-ish by insertion order)
class SimpleCache {
  constructor(maxEntries = 500) {
    this.max = maxEntries;
    this.map = new Map();
  }
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }
  set(key, value, ttlMs) {
    if (this.map.size >= this.max) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    const expiresAt = ttlMs ? Date.now() + ttlMs : 0;
    this.map.set(key, { value, expiresAt });
    return value;
  }
}

const imgCache = new SimpleCache(PET_CACHE_MAX_ENTRIES);
const dataCache = new SimpleCache(PET_CACHE_MAX_ENTRIES);
const cardCache = new SimpleCache(Math.max(100, PET_CACHE_MAX_ENTRIES));
// แผนที่ in-flight สำหรับแชร์ผลลัพธ์ที่กำลังเรนเดอร์ (de-dup)
const inFlightCards = new Map();

async function loadImageCached(filePath) {
  const k = `img:${filePath}`;
  const cached = imgCache.get(k);
  if (cached) return cached;
  const img = await Canvas.loadImage(filePath);
  return imgCache.set(k, img, 10 * 60 * 1000); // 10 นาที
}

async function readFileBase64(filePath) {
  const k = `b64:${filePath}`;
  const cached = dataCache.get(k);
  if (cached) return cached;
  const buf = await fsp.readFile(filePath);
  const v = `data:image/png;base64,${buf.toString('base64')}`;
  return dataCache.set(k, v, 10 * 60 * 1000);
}

// (ลบ getPngEntries: ไม่ใช้งานแล้วเพราะเปลี่ยนไปใช้รายชื่อเฟรมจาก CDN)

async function readJsonIfExists(filePath, ttlMs = 10 * 60 * 1000) {
  const k = `json:${filePath}`;
  const cached = dataCache.get(k);
  if (cached) return cached;
  try {
    const txt = await fsp.readFile(filePath, 'utf8');
    const obj = JSON.parse(txt);
    return dataCache.set(k, obj, ttlMs);
  } catch {
    return dataCache.set(k, null, 60 * 1000);
  }
}

// Semaphore เพื่อจำกัด concurrent ของการเข้ารหัส GIF ภายในเครื่อง
function createSemaphore(max) {
  let available = max;
  const queue = [];
  async function acquire(timeoutMs = 0) {
    if (available > 0) {
      available -= 1;
      return () => { available += 1; if (queue.length) queue.shift()(); };
    }
    return await new Promise((resolve, reject) => {
      const token = () => {
        available -= 1;
        resolve(() => { available += 1; if (queue.length) queue.shift()(); });
      };
      queue.push(token);
      if (timeoutMs > 0) {
        setTimeout(() => {
          const idx = queue.indexOf(token);
          if (idx !== -1) queue.splice(idx, 1);
          reject(new Error('SEMAPHORE_TIMEOUT'));
        }, timeoutMs);
      }
    });
  }
  return { acquire };
}
const localGifSemaphore = createSemaphore(PET_LOCAL_GIF_MAX_CONCURRENCY);

// helper: แปลง emotion/pose เป็นข้อความภาษาไทยสั้นๆ
function getThaiStatusText(emotion, poseKey) {
  if (poseKey === 'seep') return 'PET CARD';
  switch (emotion) {
    case 'angry': return 'PET CARD';
    case 'happy': return 'PET CARD';
    case 'hungry': return 'PET CARD';
    case 'playing': return 'PET CARD';
    case 'sleep': return  'PET CARD';
    case 'smelly': return 'PET CARD';
    case 'unclean': return 'PET CARD';
    default: return 'PET CARD';
  }
}

// คำแนะนำตามสถานะ (สำหรับ footer)
function getAdviceText(emotion, poseKey) {
  if (poseKey === 'seep') return 'ซึมๆ • แนะนำ: ให้พักผ่อนหรือเล่นด้วยเพื่อเพิ่ม Affection';
  switch (emotion) {
    case 'angry': return 'โกรธ • แนะนำ: เล่นด้วยเพื่อเพิ่มความสุขและตรวจความสะอาด';
    case 'happy': return 'มีความสุข • แนะนำ: รักษาค่าความเอ็นดูเเละค่าความอิ่มต่อเนื่อง';
    case 'hungry': return 'หิว • แนะนำ: ให้อาหารเพื่อเพิ่มค่าความอิ่ม';
    case 'playing': return 'พร้อมเล่น • แนะนำ: เล่นด้วยเพื่อเพิ่มค่าความเอ็นดู';
    case 'sleep': return 'ง่วง/พักผ่อน • แนะนำ: ให้พักเพื่อลดความล้า';
    case 'smelly': return 'เหม็น • แนะนำ: อาบน้ำเพื่อลดความสกปรก';
    case 'unclean': return 'สกปรก • แนะนำ: ทำความสะอาดเพื่อลดความสกปรก';
    default: return 'ปกติ • แนะนำ: ดูแลทั่วไป เช่น เล่น/ให้อาหารตามจำเป็น';
  }
}

// helper: วาดข้อความสถานะตรงกลางการ์ด (ช่องสีขาว)
function drawCenterStatus(ctx, text) {
  const centerX = (ctx?.canvas?.width || 270) / 2;
  const statusY = parseInt(process.env.PET_STATUS_Y || '88');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // ใช้ฟอนต์ไทย ถ้าลงทะเบียนได้ สำรองเป็น sans-serif
  const fontFamily = THAI_FONT_READY ? STATUS_FONT_FAMILY : 'sans-serif';
  const fontSize = parseInt(process.env.PET_STATUS_FONT_SIZE || '12');
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  // เงาบางๆ ให้ตัวอักษรอ่านง่าย
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text, centerX, statusY + 1);
  ctx.fillStyle = '#000000';
  ctx.fillText(text, centerX, statusY);
  ctx.restore();
}

// helper: วาดบาร์สถานะลง context (ใช้ค่านิยามใหม่เป็นหลัก)
function drawStatusBars(ctx, pet) {
  const exp = pet.exp / pet.nextexp;
  const expbar = Math.round(159 * exp);
  const expbar2 = exp > 1 ? 100 : Math.round(100 * exp);

  const affection = Number.isFinite(pet.affection) ? Number(pet.affection) : Number(pet.health || 0);
  const fullness = Number.isFinite(pet.fullness) ? Number(pet.fullness) : Number(pet.hungry || 0);
  const fatigue = Number.isFinite(pet.fatigue) ? Number(pet.fatigue) : (20 - Number(pet.sleep || 0));
  const dirtiness = Number.isFinite(pet.dirtiness) ? Number(pet.dirtiness) : (20 - Number(pet.cleanliness || 0));

  // ปรับขนาด/ตำแหน่งหลอดเพื่อไม่ให้ทับกรอบ
  const BAR_W = 57;   // เดิม ~57
  const BAR_H = 6.7;    // เดิม 10
  const L_X = 108;    // เดิม 108
  const R_X = 187;    // เดิม 187
  const ROW1_Y = 49;  // เดิม 47
  const ROW2_Y = 63;  // เดิม 61

  const affectionBar = (affection / 20) * BAR_W;
  const fullnessBar  = (fullness  / 20) * BAR_W;
  const fatigueBar   = (fatigue   / 20) * BAR_W;
  const dirtinessBar = (dirtiness / 20) * BAR_W;

  // EXP + LV/XP%
  ctx.fillStyle = "#eeb32e";
  ctx.fillRect(92, 20, expbar, 14);
  ctx.font = `bold 12px ${STATUS_FONT_FAMILY}`;
  ctx.fillStyle = "#000001";
  ctx.fillText(`LV: ${pet.level}`, 92, 30);
  ctx.font = `bold 12px ${STATUS_FONT_FAMILY}`;
  ctx.fillStyle = "#000001";
  ctx.fillText(`XP: ${expbar2 || "0"}%`, 190, 30);

  // helper: วาดเฉพาะส่วนที่เติม + เส้นแสง/เงา 2px (ไม่มีราง/กรอบ)
  const drawBarWithEffects = (x, y, w, h, fillColor) => {
    const canvasW = (ctx?.canvas?.width || 270);
    const maxW = Math.max(0, Math.min(w, canvasW - x - 8)); // กันล้น + margin ขวา 8px
    // ตัวบาร์
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, maxW, h);
    if (maxW <= 0) return;
    // ไฮไลต์ด้านบน (แสง)
    const hi = 1.5;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x, y, maxW, Math.min(hi, h));
    ctx.restore();
    // เงาด้านล่าง
    const lo = 1.5;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y + h - Math.min(lo, h), maxW, Math.min(lo, h));
    ctx.restore();
  };

  // แถวบน: Affection | Fullness (สีเดิม)
  drawBarWithEffects(L_X, ROW1_Y, affectionBar, BAR_H, "#ad2323"); // Affection ชมพู
  drawBarWithEffects(R_X, ROW1_Y, fullnessBar,  BAR_H, "#508351"); // Fullness เขียว

  // แถวล่าง: Fatigue | Dirtiness (สีเดิม)
  drawBarWithEffects(L_X, ROW2_Y, fatigueBar,   BAR_H, "#5e8078"); // Fatigue น้ำเงิน
  drawBarWithEffects(R_X, ROW2_Y, dirtinessBar, BAR_H, "#643f23"); // Dirtiness ม่วง
}

// สร้าง signature ของการ์ด เพื่อแคชผลลัพธ์ตามสถานะผู้ใช้แบบสั้น ๆ
function buildPetSignature(pet, state, poseKey) {
  const expRatio = Math.min(100, Math.round((pet.exp / pet.nextexp) * 100) || 0);
  const affection = Number.isFinite(pet.affection) ? Number(pet.affection) : Number(pet.health || 0);
  const fullness = Number.isFinite(pet.fullness) ? Number(pet.fullness) : Number(pet.hungry || 0);
  const fatigue = Number.isFinite(pet.fatigue) ? Number(pet.fatigue) : (20 - Number(pet.sleep || 0));
  const dirtiness = Number.isFinite(pet.dirtiness) ? Number(pet.dirtiness) : (20 - Number(pet.cleanliness || 0));
  return [
    `lv${pet.level}`,
    `xp${expRatio}`,
    `a${affection}`,
    `f${fullness}`,
    `t${fatigue}`,
    `d${dirtiness}`,
    `s:${state}`,
    `p:${poseKey}`,
    `type:${pet.type}`,
  ].join('|');
}

// helper: แผนที่ตำแหน่งสล็อตของบ้านให้ตรงกับพิกัดวาด (อิงจาก buildHouseLayers)
const SLOT_DRAWS = {
  A4: { x: 119, y: 24,  w: 102, h: 149 },
  A3: { x: 82,  y: 42,  w: 102, h: 149 },
  A2: { x: 45,  y: 61,  w: 102, h: 149 },
  A1: { x: 8,   y: 79,  w: 102, h: 149 },
  B4: { x: 155, y: 41,  w: 102, h: 149 },
  B3: { x: 118, y: 60,  w: 102, h: 149 },
  B2: { x: 81,  y: 79,  w: 102, h: 149 },
  B1: { x: 44,  y: 97,  w: 102, h: 149 },
  C4: { x: 191, y: 59,  w: 102, h: 149 },
  C3: { x: 154, y: 78,  w: 102, h: 149 },
  C2: { x: 117, y: 96,  w: 102, h: 149 },
  C1: { x: 80,  y: 114, w: 102, h: 149 },
  D4: { x: 227, y: 77,  w: 102, h: 149 },
  D3: { x: 190, y: 95,  w: 102, h: 149 },
  D2: { x: 153, y: 113, w: 102, h: 149 },
  D1: { x: 116, y: 131, w: 102, h: 149 },
};

function getFurnitureKeyBySlot(home, slot) {
  // slot เช่น 'A1', 'B3'
  const group = slot[0];
  const idx = slot[1];
  const groupKey = `${group}_DATA`;
  const idKey = `${slot}I`;
  return home?.[groupKey]?.[idKey];
}

// ใหม่: ตรวจว่าสล็อตถูกปิดใช้งาน/จองไว้หรือไม่ (รองรับกรณีเฟอร์นิเจอร์หลายสล็อต)
function isSlotDisabled(home, slot) {
  const group = slot[0];
  const groupKey = `${group}_DATA`;
  const disabledKey = `${slot}D`;
  return Boolean(home?.[groupKey]?.[disabledKey]);
}

// ใหม่: ตรวจว่าสล็อตถูกครอบครองหรือไม่ (true ที่ตัวสล็อต หรือมี *I)
function isSlotOccupied(home, slot) {
  const group = slot[0];
  const groupKey = `${group}_DATA`;
  const boolKey = `${slot}`;
  const idKey = `${slot}I`;
  return Boolean(home?.[groupKey]?.[boolKey]) || Boolean(home?.[groupKey]?.[idKey]);
}

// ลำดับการวาด (z-order) จากไกล → ใกล้ ให้สล็อตที่อยู่ด้านหน้ามีดัชนีสูงกว่า
const SLOT_Z_ORDER = [
  'A4','A3','A2','A1',
  'B4','B3','B2','B1',
  'C4','C3','C2','C1',
  'D4','D3','D2','D1',
];

function getSlotZIndex(slot) {
  const i = SLOT_Z_ORDER.indexOf(slot);
  return i === -1 ? 0 : i;
}

function rectsIntersect(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

// สล็อตว่างที่ไม่ถูกเฟอร์นิเจอร์ด้านหน้า (z-index สูงกว่า) บังทับ
function isSlotOccludedByFrontFurniture(home, candidateSlot) {
  const candidateRect = SLOT_DRAWS[candidateSlot];
  if (!candidateRect) return false;
  const candidateZ = getSlotZIndex(candidateSlot);
  // เดินดูทุกสล็อตที่มีเฟอร์นิเจอร์อยู่และถูกวาดหลัง candidate (z-index สูงกว่า)
  for (const slot of SLOT_Z_ORDER) {
    if (getSlotZIndex(slot) <= candidateZ) continue;
    if (!isSlotOccupied(home, slot)) continue;
    const rect = SLOT_DRAWS[slot];
    if (!rect) continue;
    if (rectsIntersect(candidateRect, rect)) return true;
  }
  return false;
}

function pickRandomEmptySlot(home) {
  const empties = SLOT_Z_ORDER.filter(s => !isSlotOccupied(home, s) && !isSlotDisabled(home, s));
  if (empties.length === 0) return null;
  // กรองสล็อตที่ถูกบังโดยเฟอร์นิเจอร์ด้านหน้าออกก่อน
  const visibleEmpties = empties.filter(s => !isSlotOccludedByFrontFurniture(home, s));
  const pool = visibleEmpties.length > 0 ? visibleEmpties : empties; // ถ้าไม่มีที่โล่งจริง ให้ fallback เป็นสล็อตว่างทั่วไป
  const rnd = pool[Math.floor(Math.random() * pool.length)];
  return { slot: rnd, draw: SLOT_DRAWS[rnd] };
}

function getEmojiByState(state) {
  switch (state) {
    case 'happy': return '😄';
    case 'sleep': return '💤';
    case 'hungry': return '🍖';
    case 'angry': return '😡';
    case 'smelly': return '🧼';
    case 'unclean': return '🧽';
    case 'playing': return '🎾';
    default: return '🐾';
  }
}

async function makeEmojiPngDataUrl(emoji) {
  const size = 42;
  const c = Canvas.createCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.floor(size * 0.8)}px sans-serif`;
  ctx.fillText(emoji, size / 2, size / 2 + 2);
  const buf = await c.encode('png');
  return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
}

async function makeSolidPngDataUrl(color = '#ffffff', width = 300, height = 300) {
  const c = Canvas.createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  const buf = await c.encode('png');
  return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
}

// สร้าง PNG ป้ายชื่อสำหรับวางบนหัว pet และคืนทั้ง URL และขนาด
async function makeNameTagDataUrl(text) {
  ensureThaiFontRegistered();
  const paddingX = 6;
  const paddingY = 3;
  const fontSize = 12;
  const fontFamily = THAI_FONT_READY ? STATUS_FONT_FAMILY : 'sans-serif';
  // วัดความกว้างข้อความ
  let c = Canvas.createCanvas(1, 1);
  let ctx = c.getContext('2d');
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(String(text || ''));
  const textW = Math.ceil(metrics.width);
  const textH = Math.ceil(fontSize + 2);
  const width = Math.max(1, textW + paddingX * 2);
  const height = Math.max(1, textH + paddingY * 2);
  c = Canvas.createCanvas(width, height);
  ctx = c.getContext('2d');
  // พื้นหลังโปร่งดำเล็กน้อย + มุมโค้ง
  const radius = 6;
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  const r = radius;
  ctx.moveTo(r, 0);
  ctx.lineTo(width - r, 0);
  ctx.quadraticCurveTo(width, 0, width, r);
  ctx.lineTo(width, height - r);
  ctx.quadraticCurveTo(width, height, width - r, height);
  ctx.lineTo(r, height);
  ctx.quadraticCurveTo(0, height, 0, height - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // ข้อความสีขาว + เงาดำบางๆ
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(String(text || ''), Math.floor(width / 2), Math.floor(height / 2));
  const buf = await c.encode('png');
  return { url: `data:image/png;base64,${Buffer.from(buf).toString('base64')}`, w: width, h: height };
}

// เรนเดอร์การ์ดสัตว์เลี้ยงและคืน buffer พร้อม format (ใช้ใน-flight de-dup)
async function renderPetCardBuffer(pet, state, poseKey) {
  // เตรียม canvas + HUD
        const canvas = Canvas.createCanvas(270, 110);
        const ctx = canvas.getContext("2d");
        const profile = await PROFILE_IMG_PROMISE;
        if (profile) {
          ctx.drawImage(profile, 0, 0, canvas.width, canvas.height);
        }
        ensureThaiFontRegistered();

  // พรีเรนเดอร์ HUD (พื้นหลัง + บาร์ + ข้อความ)
          const hudCanvas = Canvas.createCanvas(canvas.width, canvas.height);
          const hudCtx = hudCanvas.getContext('2d');
          if (profile) hudCtx.drawImage(profile, 0, 0, canvas.width, canvas.height);
          drawStatusBars(hudCtx, pet);
          drawCenterStatus(hudCtx, getThaiStatusText(state, poseKey));
          const hudPng = await hudCanvas.encode('png');
          const hudDataUrl = `data:image/png;base64,${Buffer.from(hudPng).toString('base64')}`;

  // 1) พยายามใช้ Render Service (GIF) โดยส่ง URL CDN เป็นหลัก
          try {
    // directory list จากโลคัล (เพื่อรู้ชื่อไฟล์เฟรม) แต่จะอ้างอิง URL จาก CDN
              const poseEntries = makeSequentialFrameNames(PET_CDN_DEFAULT_FRAME_COUNT, PET_CDN_FRAME_PAD);

              const framesLayers = [];
              let needStaticPet = true;
              if (poseEntries.length >= 2) {
      const framesPose = poseEntries.map(name => ({
        url: cdnPoseFrameUrl(poseKey, pet.type, name),
        draw: { ...PET_DRAW_DEFAULT }
                  }));
                  framesLayers.push({ type: 'pet_gif_frames', frames: framesPose });
                  needStaticPet = false;
              }
              if (needStaticPet) {
      // พยายามใช้ CDN รูปนิ่งก่อน ไม่อ่านไฟล์โลคัลอีกต่อไป
      const cdnUrl = cdnPetStaticUrl(state, pet.type);
      let staticUrl = cdnUrl;
      if (staticUrl) {
                      const bounce = [0, -1, 0, 1, 0, 0];
                      const framesStatic = bounce.map(dy => ({
          url: staticUrl,
                        draw: { x: PET_DRAW_DEFAULT.x, y: PET_DRAW_DEFAULT.y + dy, w: PET_DRAW_DEFAULT.w, h: PET_DRAW_DEFAULT.h }
                      }));
                      framesLayers.push({ type: 'pet_gif_frames', frames: framesStatic });
                  }
              }

    // ส่ง HUD ที่มี UI elements แทนที่จะส่งแค่ profile background
    const staticLayers = [
      { type: 'static', url: hudDataUrl, draw: { x: 0, y: 0, w: canvas.width, h: canvas.height } },
    ];

              if (framesLayers.length > 0) {
                const queue = getRenderQueue();
                const payload = {
        guild: 'g',
        user: 'u',
                    size: { width: canvas.width, height: canvas.height },
                    format: 'gif',
                    gifOptions: { delayMs: PET_GIF_DELAY_MS, repeat: 0, quality: PET_GIF_QUALITY },
                    layers: [
                        ...staticLayers,
                        ...framesLayers,
                    ],
                };
                const { jobId } = await queue.enqueue(payload);
                const result = await Promise.race([
                  queue.waitForResult(jobId),
                  new Promise((_, rej) => setTimeout(() => rej(new Error('RENDER_TIMEOUT')), PET_RENDER_TIMEOUT_MS))
                ]);
                const buf = await fetchBuffer(result.url);
      return { format: 'gif', buffer: buf };
    }
  } catch (_) { /* จะลอง local/PNG ต่อไป */ }

  // 2) local GIF (ถ้าเปิด concurrency > 0) — จะพยายามโหลดจาก CDN ก่อน
  if (PET_LOCAL_GIF_MAX_CONCURRENCY > 0) {
             try {
              const poseEntries = makeSequentialFrameNames(PET_CDN_DEFAULT_FRAME_COUNT, PET_CDN_FRAME_PAD);
 
      if (poseEntries.length >= 2) {
                   let release;
         try { release = await localGifSemaphore.acquire(2000); } catch (_) { throw new Error('LOCAL_SEMAPHORE_BUSY'); }
 
         const encoder = new GIFEncoder(270, 110, 'octree');
                   encoder.setDelay(PET_GIF_DELAY_MS);
                   encoder.setRepeat(0);
                   encoder.setQuality(PET_GIF_QUALITY);
                   encoder.start();
 
        // โหลดจาก CDN เท่านั้น; กรองเฟรมที่โหลดไม่สำเร็จออก
        const settled = await Promise.allSettled(poseEntries.map(name => Canvas.loadImage(cdnPoseFrameUrl(poseKey, pet.type, name))));
        const poseImages = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
        if (poseImages.length < 2) {
          // โหลดได้ไม่พอสำหรับอนิเมชัน → ตกไปทำ GIF เด้งจากรูปนิ่ง
          throw new Error('CDN_FRAMES_INSUFFICIENT');
        }
                   const hudLayer = await Canvas.loadImage(Buffer.from(hudPng)).catch(() => null);
 
                   try {
           for (let i = 0; i < poseImages.length; i++) {
             ctx.clearRect(0, 0, 270, 110);
             if (hudLayer) ctx.drawImage(hudLayer, 0, 0, 270, 110);
                              const poseImg = poseImages[i % poseImages.length];
                              ctx.drawImage(poseImg, PET_DRAW_DEFAULT.x, PET_DRAW_DEFAULT.y, PET_DRAW_DEFAULT.w, PET_DRAW_DEFAULT.h);
             const rgba = ctx.getImageData(0, 0, 270, 110).data;
                          encoder.addFrame(rgba);
                      }
                   } finally {
                     encoder.finish();
           if (typeof release === 'function') { try { release(); } catch (_) {} }
                   }
                   const gifBuf = Buffer.from(encoder.out.getData());
         return { format: 'gif', buffer: gifBuf };
       } else {
         // ไม่มีรายชื่อเฟรม → ทำ GIF เด้งจากรูปนิ่ง CDN (ไม่แตะไฟล์โลคัล)
         let release;
         try { release = await localGifSemaphore.acquire(2000); } catch (_) { throw new Error('LOCAL_SEMAPHORE_BUSY'); }
         const encoder = new GIFEncoder(270, 110, 'octree');
         encoder.setDelay(PET_GIF_DELAY_MS);
         encoder.setRepeat(0);
         encoder.setQuality(PET_GIF_QUALITY);
         encoder.start();
         const hudLayer = await Canvas.loadImage(Buffer.from(hudPng)).catch(() => null);
         const staticUrl = cdnPetStaticUrl(state, pet.type);
         const staticImg = await Canvas.loadImage(staticUrl);
         const bounce = [0, -1, 0, 1, 0, 0];
         try {
           for (const dy of bounce) {
             ctx.clearRect(0, 0, 270, 110);
             if (hudLayer) ctx.drawImage(hudLayer, 0, 0, 270, 110);
             ctx.drawImage(staticImg, PET_DRAW_DEFAULT.x, PET_DRAW_DEFAULT.y + dy, PET_DRAW_DEFAULT.w, PET_DRAW_DEFAULT.h);
             const rgba = ctx.getImageData(0, 0, 270, 110).data;
             encoder.addFrame(rgba);
           }
         } finally {
           encoder.finish();
           if (typeof release === 'function') { try { release(); } catch (_) {} }
         }
         const gifBuf = Buffer.from(encoder.out.getData());
         return { format: 'gif', buffer: gifBuf };
       }
     } catch (_) { /* ตกไป PNG */ }
   }

  // 3) PNG ตกหล่น — ใช้ CDN ถ้าได้ ไม่งั้นใช้ไฟล์โลคัล
  try {
    // วาด HUD
              try {
                const hudImg = await Canvas.loadImage(Buffer.from(hudPng));
                ctx.drawImage(hudImg, 0, 0, 270, 110);
              } catch (_) {
                // Fallback to local profile image with UI elements
                const profile = await PROFILE_IMG_PROMISE;
                if (profile) ctx.drawImage(profile, 0, 0, 270, 110);
                drawStatusBars(ctx, pet);
                drawCenterStatus(ctx, getThaiStatusText(state, poseKey));
              }

    async function drawStaticFromCdnOrLocal(stateName) {
      const cdnUrl = cdnPetStaticUrl(stateName, pet.type);
      try {
        const img = await Canvas.loadImage(cdnUrl);
        ctx.drawImage(img, PET_DRAW_DEFAULT.x, PET_DRAW_DEFAULT.y, PET_DRAW_DEFAULT.w, PET_DRAW_DEFAULT.h);
        return;
      } catch (_) {
        // ไม่โหลดไฟล์โลคัลอีกต่อไปเมื่อ CDN ใช้งานไม่ได้
      }
    }

              if (state === 'happy') {
      await drawStaticFromCdnOrLocal('happy');
              } else if (state === 'sleep') {
      await drawStaticFromCdnOrLocal('sleep');
              } else {
      await drawStaticFromCdnOrLocal('hungry');
              }

              const pngBuf = await canvas.encode('png');
    return { format: 'png', buffer: pngBuf };
            } catch (_) {
    return null;
          }
        }

// เรนเดอร์บ้านเป็น GIF attachment (ทำงานฉากหลัง)
async function renderHouseAttachment(home, pet, state, poseKey) {
        try {
    pdbg('house.config', { HOUSE_TRANSPARENT_BG, PET_HOUSE_BG_KEY, PET_HOUSE_BG_URL, PET_ASSET_BASE_URL, PET_ASSET_PATH_PREFIX });
            let houseLayers = buildHouseLayers(home);
    pdbg('house.layers.init', { count: Array.isArray(houseLayers) ? houseLayers.length : 0 });
            if (HOUSE_TRANSPARENT_BG) {
              houseLayers = houseLayers.filter(l => l.type !== 'background');
      pdbg('house.layers.transparent', { after: houseLayers.length });
            }

            const chosen = pickRandomEmptySlot(home);
    pdbg('house.slot', { chosen });
    
            // เพิ่ม poop layers ถ้ามี
            const poopLayers = [];
            pdbg('house.poop.check', { POOP_DATA: home?.POOP_DATA });
            if (home?.POOP_DATA) {
              for (const [slot, hasPoop] of Object.entries(home.POOP_DATA)) {
                pdbg('house.poop.slot', { slot, hasPoop, slotDraw: SLOT_DRAWS[slot] });
                if (hasPoop && SLOT_DRAWS[slot]) {
                  const slotRect = SLOT_DRAWS[slot];
                  // ใช้ anchor กลางด้านล่างของสล็อต (เหมือนสัตว์เลี้ยง) แล้วเลื่อนขึ้นเล็กน้อย
                  const anchorX = slotRect.x + (slotRect.w / 2);
                  const anchorY = slotRect.y + slotRect.h;
                  const poopWidth = 26;
                  const poopHeight = 26;
                  // วางให้กึ่งกลาง poop อยู่แถว ๆ ใต้เท้าสัตว์เลี้ยงเล็กน้อย (เลื่อนขึ้น 8px)
                  let poopX = Math.round(anchorX - (poopWidth / 2));
                  let poopY = Math.round(anchorY - Math.floor(poopHeight / 2) - 8);
                  // clamp ภายในแคนวาส 300x300
                  poopX = Math.max(0, Math.min(poopX, 300 - poopWidth));
                  poopY = Math.max(0, Math.min(poopY, 300 - poopHeight));
                  
                  const poopLayer = {
                    type: 'static',
                    url: 'https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/poop.png',
                    draw: { x: poopX, y: poopY, w: poopWidth, h: poopHeight }
                  };
                  poopLayers.push(poopLayer);
                  pdbg('house.poop.added', { slot, poopLayer });
                }
              }
            }
            pdbg('house.poop.layers', { count: poopLayers.length, layers: poopLayers });

            const baseLayers = houseLayers.filter(l => l.type !== 'furniture');
            const furnitureLayers = houseLayers.filter(l => l.type === 'furniture');
    pdbg('house.layers.split', { base: baseLayers.length, furniture: furnitureLayers.length });
            const DEPTH_ORDER = ['A4','A3','A2','A1','B4','B3','B2','B1','C4','C3','C2','C1','D4','D3','D2','D1'];
            function rankFromDraw(draw) {
              const y = Number.isFinite(draw?.y) ? draw.y : 0;
              const x = Number.isFinite(draw?.x) ? draw.x : 0;
              return y * 100 + x;
            }
            function getSlotRank(slotId, draw) {
              const r = DEPTH_ORDER.indexOf(String(slotId || ''));
              return r !== -1 ? r : rankFromDraw(draw);
            }
            const sortedFurniture = [...furnitureLayers].sort((a, b) => {
              const ia = getSlotRank(a.slot, a.draw);
              const ib = getSlotRank(b.slot, b.draw);
              return ia - ib;
            });

            async function toStaticLayer(layer) {
              if (!layer) return null;
              if (layer.type === 'room-bg') {
                if (HOUSE_TRANSPARENT_BG) return null;
                const key = String(layer.key || 'default');
                return { type: 'room-bg', key, draw: layer.draw };
              }
              if (layer.type === 'floor') {
                return { type: 'floor', key: layer.key, draw: layer.draw };
              }
              if (layer.type === 'wallpaper-left' || layer.type === 'wallpaper-right') {
                return { type: layer.type, key: layer.key, draw: layer.draw };
              }
              if (layer.type === 'background') {
                return null;
              }
              if (layer.type === 'furniture') {
                return null;
              }
              return null;
            }

            const poseEntriesH = makeSequentialFrameNames(PET_CDN_DEFAULT_FRAME_COUNT, PET_CDN_FRAME_PAD);
            const emoteEntriesH = makeSequentialFrameNames(PET_CDN_EMOTE_DEFAULT_FRAME_COUNT, PET_CDN_FRAME_PAD);
    pdbg('house.frames', { poseEntries: poseEntriesH.length, emoteEntries: emoteEntriesH.length });

            const layersHouse = [];
            const staticBase = (await Promise.all(baseLayers.map(toStaticLayer))).filter(Boolean);
            layersHouse.push(...staticBase);
    if (!HOUSE_TRANSPARENT_BG) {
      const hasBg = layersHouse.some(l => l && (l.type === 'room-bg' || l.type === 'background'));
      pdbg('house.bg.has', { hasBg });
      // ปิดการ inject local background เพราะใช้ CDN แทน
      // if (!hasBg) {
      //   // 1) local file (data URL) first
      //   if (PET_HOUSE_BG_LOCAL_PATH && fs.existsSync(PET_HOUSE_BG_LOCAL_PATH)) {
      //     try {
      //       pdbg('house.bg.local.try', { path: PET_HOUSE_BG_LOCAL_PATH });
      //       const dataUrl = await readFileBase64(PET_HOUSE_BG_LOCAL_PATH);
      //       layersHouse.unshift({ type: 'static', url: dataUrl, draw: { x: 0, y: 0, w: 300, h: 300 } });
      //       pdbg('house.bg.inject', { via: 'local:data-url', path: PET_HOUSE_BG_LOCAL_PATH, dataUrlLength: dataUrl?.length });
      //     } catch (e) {
      //       pdbg('house.bg.local.error', { path: PET_HOUSE_BG_LOCAL_PATH, message: e?.message });
      //     }
      //   } else {
      //     pdbg('house.bg.local.skip', { path: PET_HOUSE_BG_LOCAL_PATH, exists: fs.existsSync(PET_HOUSE_BG_LOCAL_PATH || '') });
      //   }
      //   // 2) room-bg by key (renderer resolves to CDN)
      //   if (!layersHouse.some(l => l && l.type === 'static' && l.draw?.x === 0 && l.draw?.y === 0 && l.draw?.w === 300 && l.draw?.h === 300)) {
      //     if (PET_HOUSE_BG_KEY) {
      //       layersHouse.unshift({ type: 'room-bg', key: PET_HOUSE_BG_KEY, draw: { x: 0, y: 0, w: 300, h: 300 } });
      //       pdbg('house.bg.inject', { via: 'room-bg:key', key: PET_HOUSE_BG_KEY });
      //     } else if (PET_HOUSE_BG_URL) {
      //       // 3) static URL fallback
      //       layersHouse.unshift({ type: 'static', url: PET_HOUSE_BG_URL, draw: { x: 0, y: 0, w: 300, h: 300 } });
      //       pdbg('house.bg.inject', { via: 'static:url', url: PET_HOUSE_BG_URL });
      //     }
      //   } else {
      //     pdbg('house.bg.already', { message: 'background layer already exists' });
      //   }
      // }
    } else {
      pdbg('house.bg.transparent', { HOUSE_TRANSPARENT_BG });
    }

            if (chosen) {
              const slotRect = chosen.draw || PET_INHOUSE_DRAW;
              const targetWidth = PET_DRAW_DEFAULT.w;
              const targetHeight = PET_DRAW_DEFAULT.h;
              const anchorX = slotRect.x + (slotRect.w / 2);
              const anchorY = slotRect.y + slotRect.h;
              let targetX = Math.round(anchorX - (targetWidth / 2) + PET_SLOT_ANCHOR_OFFSET_X);
              let targetY = Math.round(anchorY - targetHeight + PET_SLOT_ANCHOR_OFFSET_Y);
              targetX = Math.max(0, Math.min(targetX, 300 - targetWidth));
              targetY = Math.max(0, Math.min(targetY, 300 - targetHeight));
              const PET_DRAW_INHOUSE_DYNAMIC = { x: targetX, y: targetY, w: targetWidth, h: targetHeight };

              const poseFrameCount = (poseEntriesH.length >= 2) ? poseEntriesH.length : 0;
              const emoteFrameCount = (emoteEntriesH.length >= 2) ? emoteEntriesH.length : 0;
              const totalFrameCount = Math.max(poseFrameCount, emoteFrameCount, 1);

              const petLayers = [];
              if (poseEntriesH.length >= 2) {
        const framesPose = poseEntriesH.map(name => ({
          url: cdnPoseFrameUrl(poseKey, pet.type, name),
          draw: { ...PET_DRAW_INHOUSE_DYNAMIC }
                }));
                petLayers.push({ type: 'pet_gif_frames', frames: framesPose });
              } else {
        // static pet ใช้ CDN เท่านั้น ไม่อ่านไฟล์โลคัล
        let staticUrl = cdnPetStaticUrl(state, pet.type);
        if (staticUrl) petLayers.push({ type: 'static', url: staticUrl, draw: { ...PET_DRAW_INHOUSE_DYNAMIC } });
              }

              const emoteLayers = [];
              if (emoteEntriesH.length >= 2) {
                const EMOTE_W = PET_HOUSE_EMOTE_SIZE;
                const EMOTE_H = PET_HOUSE_EMOTE_SIZE;
                const rawX = PET_DRAW_INHOUSE_DYNAMIC.x + PET_HOUSE_EMOTE_OFFSET_X;
                const rawY = PET_DRAW_INHOUSE_DYNAMIC.y + PET_HOUSE_EMOTE_OFFSET_Y;
                const emoteX = Math.max(0, Math.min(rawX, 300 - EMOTE_W));
                const emoteY = Math.max(0, Math.min(rawY, 300 - EMOTE_H));
                const EMOTE_DRAW_INHOUSE = { x: emoteX, y: emoteY, w: EMOTE_W, h: EMOTE_H };
        const framesEmote = emoteEntriesH.map(name => ({
          url: cdnEmoteFrameUrl(state, name),
          draw: { ...EMOTE_DRAW_INHOUSE }
                }));
                emoteLayers.push({ type: 'pet_gif_frames', frames: framesEmote });
              }

              const petRank = chosen?.slot ? getSlotRank(chosen.slot, chosen.draw) : rankFromDraw(chosen?.draw);
              const furnBack = sortedFurniture.filter(fl => getSlotRank(fl.slot, fl.draw) <= petRank);
              const furnFront = sortedFurniture.filter(fl => getSlotRank(fl.slot, fl.draw) > petRank);

              for (const fl of furnBack) {
                try {
                  const key = String(fl.key || '').trim();
                  if (!key) continue;
                  layersHouse.push({ type: 'furniture', key, draw: fl.draw });
                } catch (_) { /* skip furniture */ }
              }

              // วาง poop ใต้ pet/emote เพื่อให้สัตว์เลี้ยงและอีโมจิทับอยู่ด้านบน
              for (const layer of poopLayers) layersHouse.push(layer);
              for (const layer of petLayers) layersHouse.push(layer);
              for (const layer of emoteLayers) layersHouse.push(layer);

              try {
                const petName = String(pet?.name || '').trim();
                if (petName) {
                  const tag = await makeNameTagDataUrl(petName);
                  const centerX = PET_DRAW_INHOUSE_DYNAMIC.x + Math.floor(PET_DRAW_INHOUSE_DYNAMIC.w / 2);
                  const rawX = Math.round(centerX - Math.floor(tag.w / 2));
                  const rawY = Math.round(PET_DRAW_INHOUSE_DYNAMIC.y - tag.h - 4);
                  const tagX = Math.max(0, Math.min(rawX, 300 - tag.w));
                  const tagY = Math.max(0, Math.min(rawY, 300 - tag.h));
                  const draw = { x: tagX, y: tagY, w: tag.w, h: tag.h };
                  const frames = Array.from({ length: totalFrameCount }, () => ({ url: tag.url, draw }));
                  layersHouse.push({ type: 'pet_gif_frames', frames });
                }
              } catch (_) { /* ignore name tag errors */ }

              for (const fl of furnFront) {
                try {
                  const key = String(fl.key || '').trim();
                  if (!key) continue;
                  layersHouse.push({ type: 'furniture', key, draw: fl.draw });
                } catch (_) { /* skip furniture */ }
              }
    } else {
      pdbg('house.slot.fallback', { using: 'PET_INHOUSE_DRAW' });
      // Fallback: ไม่มีสล็อตว่าง/ถูกบังทั้งหมด → วาง pet ตำแหน่งค่าเริ่มต้นและให้อยู่บนสุดเพื่อให้มองเห็นแน่นอน
      const PET_DRAW_FALLBACK = { ...PET_INHOUSE_DRAW };
      const petLayers = [];
      if (poseEntriesH.length >= 2) {
        const framesPose = poseEntriesH.map(name => ({
          url: cdnPoseFrameUrl(poseKey, pet.type, name),
          draw: { ...PET_DRAW_FALLBACK }
        }));
        petLayers.push({ type: 'pet_gif_frames', frames: framesPose });
      } else {
        let staticUrl = cdnPetStaticUrl(state, pet.type);
        if (staticUrl) petLayers.push({ type: 'static', url: staticUrl, draw: { ...PET_DRAW_FALLBACK } });
      }
      const emoteLayers = [];
      if (emoteEntriesH.length >= 2) {
        const EMOTE_W = PET_HOUSE_EMOTE_SIZE;
        const EMOTE_H = PET_HOUSE_EMOTE_SIZE;
        const rawX = PET_DRAW_FALLBACK.x + PET_HOUSE_EMOTE_OFFSET_X;
        const rawY = PET_DRAW_FALLBACK.y + PET_HOUSE_EMOTE_OFFSET_Y;
        const emoteX = Math.max(0, Math.min(rawX, 300 - EMOTE_W));
        const emoteY = Math.max(0, Math.min(rawY, 300 - EMOTE_H));
        const EMOTE_DRAW_INHOUSE = { x: emoteX, y: emoteY, w: EMOTE_W, h: EMOTE_H };
        const framesEmote = emoteEntriesH.map(name => ({
          url: cdnEmoteFrameUrl(state, name),
          draw: { ...EMOTE_DRAW_INHOUSE }
        }));
        emoteLayers.push({ type: 'pet_gif_frames', frames: framesEmote });
      }
      // วางเฟอร์นิเจอร์ทั้งหมดก่อน แล้วค่อยวาง pet บนสุดเพื่อให้ไม่ถูกบัง
      for (const fl of sortedFurniture) {
        try {
          const key = String(fl.key || '').trim();
          if (!key) continue;
          layersHouse.push({ type: 'furniture', key, draw: fl.draw });
        } catch (_) { /* skip furniture */ }
      }
      // วาง poop ก่อน เพื่อให้ pet/emote อยู่หน้าสุดเหนือ poop
      for (const layer of poopLayers) layersHouse.push(layer);
      for (const layer of petLayers) layersHouse.push(layer);
      for (const layer of emoteLayers) layersHouse.push(layer);
    }

    pdbg('house.layers.final', { count: layersHouse.length });
            const queue = getRenderQueue();
            const payloadHouse = {
      guild: 'g',
      user: 'u',
              size: { width: 300, height: 300 },
              format: 'gif',
              gifOptions: { delayMs: PET_GIF_DELAY_MS, repeat: 0, quality: PET_HOUSE_GIF_QUALITY, transparent: true, backgroundColorHex: '#1a1a1e' },
              layers: layersHouse,
            };
    pdbg('house.enqueue', { layers: layersHouse.length, format: payloadHouse.format });
            const { jobId: houseJobId } = await queue.enqueue(payloadHouse);
            const resultHouse = await Promise.race([
              getRenderQueue().waitForResult(houseJobId),
              new Promise((_, rej) => setTimeout(() => rej(new Error('RENDER_TIMEOUT')), PET_RENDER_TIMEOUT_MS))
            ]);
    pdbg('house.result.meta', { format: resultHouse?.format, url: resultHouse?.url });
            const bufHouse = await fetchBuffer(resultHouse.url);
    const ext = (resultHouse && String(resultHouse.format).toLowerCase() === 'png') ? 'png' : 'gif';
    pdbg('house.result.ready', { ext, size: Buffer.isBuffer(bufHouse) ? bufHouse.length : 0 });
    return new AttachmentBuilder(bufHouse, { name: `house_pet.${ext}` });
  } catch (e) {
    pdbg('house.error', { message: e?.message });
    return null;
  }
}

async function execute(client, interaction) {
    let pet, msg;
    
    try {
        await interaction.deferReply({ ephemeral: false });

        pet = await GPet.findOne({ guild: interaction.guild.id, user: interaction.user.id });
        if(!pet) {
            return interaction.editReply({ embeds: [buildInfoEmbed('คุณยังไม่มีสัตว์เลี้ยง', '#e74c3c', 'แจ้งเตือน')] });
        }

        msg = await interaction.editReply({ embeds: [buildInfoEmbed('กำลังโหลดสัตว์เลี้ยงของคุณ...', '#e74c3c', 'กำลังโหลด')] });
    } catch (error) {
        console.error('Error in pet command:', error);
        // ตรวจสอบสถานะ interaction ก่อน reply
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({ embeds: [buildInfoEmbed('เกิดข้อผิดพลาดในการโหลด pet กรุณาลองใหม่', '#e74c3c', 'ข้อผิดพลาด')], ephemeral: true });
            } catch (replyError) {
                console.error('Failed to reply to interaction:', replyError);
            }
        } else if (interaction.deferred && !interaction.replied) {
            try {
                await interaction.editReply({ embeds: [buildInfoEmbed('เกิดข้อผิดพลาดในการโหลด pet กรุณาลองใหม่', '#e74c3c', 'ข้อผิดพลาด')] });
            } catch (editError) {
                console.error('Failed to edit interaction:', editError);
            }
        }
        return;
    }

    // คำนวณสถานะ/ท่าเพียงครั้งเดียว
    const state = getEmotionKey(pet);
    const poseKey = getPoseKey(pet);
    
    // แสดงข้อมูลเพิ่มเติมจากระบบใหม่
    const health = calculateHealth(pet);
    const healthStatus = getHealthStatus(health);
    const needsUrgent = needsUrgentCare(pet);

    // เริ่มโหลดข้อมูลบ้านแบบขนาน (ถ้าเปิดใช้งาน)
    const homeDocPromise = PET_INCLUDE_HOUSE ? GHome.findOne({ guild: interaction.guild.id, user: interaction.user.id }).lean() : Promise.resolve(null);

    // เตรียม promise เรนเดอร์การ์ดสัตว์เลี้ยง (เริ่มทันที แต่ยังไม่ await)
    const signature = buildPetSignature(pet, state, poseKey);
    const cardKey = `card:${interaction.guild.id}:${interaction.user.id}:${signature}`;
    let cardPromise;
    const cachedCard = cardCache.get(cardKey);
    if (cachedCard) {
      cardPromise = Promise.resolve(cachedCard);
    } else if (inFlightCards.has(cardKey)) {
      cardPromise = inFlightCards.get(cardKey);
    } else {
      const p = (async () => {
        const out = await renderPetCardBuffer(pet, state, poseKey);
        if (out) cardCache.set(cardKey, out, PET_CARD_TTL_MS);
        return out;
      })();
      inFlightCards.set(cardKey, p);
      cardPromise = p.finally(() => inFlightCards.delete(cardKey));
    }

    // เตรียม promise เรนเดอร์บ้าน (เริ่มทันที แต่ยังไม่ await)
    const housePromise = (async () => {
      try {
        const home = await homeDocPromise;
        if (!home) return null;
        return await renderHouseAttachment(home, pet, state, poseKey);
      } catch (_) {
        return null;
      }
    })();

      const displayName = (interaction.member && interaction.member.displayName) ? interaction.member.displayName : interaction.user.username;

    // รอทั้งสองผลลัพธ์ จากนั้นส่งพร้อมกัน (มี timeout 25 วินาที)
    try {
      // ตรวจสอบ render service ก่อน
      const queue = getRenderQueue();
      try {
        await queue.healthCheck();
        console.log('Render service is healthy');
      } catch (healthError) {
        console.warn('Render service health check failed:', healthError.message);
      }

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RENDER_TIMEOUT')), 25000)
      );
      const [out, houseAttachment] = await Promise.race([
        Promise.all([cardPromise, housePromise]),
        timeoutPromise
      ]);

      const files = [];
      const embeds = [];

      if (houseAttachment) {
        // แนบไฟล์บ้านอย่างเดียว ไม่สร้าง embed สำหรับบ้าน
        files.push(houseAttachment);
      }

      if (out) {
        const attName = out.format === 'gif' ? 'profile.gif' : 'profile.png';
        const petAttachment = new AttachmentBuilder(out.buffer, { name: attName });
        files.push(petAttachment);
        const fireStreakText = getFireStreakText(pet.fireStreak || 0);
        const authorName = fireStreakText ? `${interaction.user.username}'s Pet • ${fireStreakText}` : `${interaction.user.username}'s Pet`;
        
        // สร้าง footer text ที่รวมข้อมูลสุขภาพ
        let footerText = getAdviceText(state, poseKey);
        if (needsUrgent) {
            footerText += ' • 🚨 ต้องการการดูแลเร่งด่วน!';
        } else if (health < 10) {
            footerText += ` • 🏥 สุขภาพ: ${health}/20 (${healthStatus})`;
        }
        
        const petEmbed = new EmbedBuilder()
          .setAuthor({ name: authorName, iconURL: interaction.user.avatarURL() })
          .setImage(`attachment://${attName}`)
          .setColor(needsUrgent ? '#e8f093' : (health >= 15 ? '#e8f093' : client.color))
          .setFooter({ text: footerText });
        embeds.push(petEmbed);
      }

      if (embeds.length > 0 || files.length > 0) {
        const fireStreakText = getFireStreakText(pet.fireStreak || 0);
        const streakSuffix = fireStreakText ? ` • ${fireStreakText}` : '';
        await msg.edit({
          content: (houseAttachment && out)
            ? `> **แสดงบ้านของคุณ • [** ${displayName} **]**${streakSuffix}`
            : (out ? `> **แสดงสัตว์เลี้ยงของคุณ • [** ${displayName} **]**${streakSuffix}` : `> **แสดงบ้านของคุณ • [** ${displayName} **]**${streakSuffix}`),
          embeds,
          files
        });
    } else {
      await msg.edit({ embeds: [buildInfoEmbed('ไม่สามารถสร้างผลลัพธ์ได้ กรุณาลองใหม่อีกครั้ง', '#e74c3c', 'ข้อผิดพลาด')], files: [] });
    }
  } catch (error) {
      console.error('Error rendering pet:', error);
      try {
        // ตรวจสอบว่า interaction ยังใช้งานได้หรือไม่
        if (interaction.replied || interaction.deferred) {
          if (error.message === 'RENDER_TIMEOUT') {
            await interaction.editReply({ embeds: [buildInfoEmbed('⏰ การสร้าง pet card ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง', '#e67e22', 'หมดเวลา')], files: [] });
          } else {
            await interaction.editReply({ embeds: [buildInfoEmbed('❌ เกิดข้อผิดพลาดในการสร้าง pet card กรุณาลองใหม่อีกครั้ง', '#e74c3c', 'ข้อผิดพลาด')], files: [] });
          }
        } else {
          // ถ้า interaction ยังไม่ได้ reply ให้ reply ใหม่
          await interaction.reply({ embeds: [buildInfoEmbed('❌ เกิดข้อผิดพลาดในการสร้าง pet card กรุณาลองใหม่อีกครั้ง', '#e74c3c', 'ข้อผิดพลาด')], ephemeral: true });
        }
      } catch (editError) {
        console.error('Failed to edit message:', editError);
        // ถ้า edit ไม่ได้ ให้พยายาม reply ใหม่
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ embeds: [buildInfoEmbed('❌ เกิดข้อผิดพลาดในการสร้าง pet card กรุณาลองใหม่อีกครั้ง', '#e74c3c', 'ข้อผิดพลาด')], ephemeral: true });
          }
        } catch (finalError) {
          console.error('Failed to send final error message:', finalError);
        }
      }
    }
}

module.exports = {
  name: ["สัตว์เลี้ยง", "บ้าน"],
  description: "เเสดงสัตว์เลี้ยงของคุณ",
  category: "Pet",
  run: execute
}
