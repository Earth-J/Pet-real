// สร้างหลอดแบบ custom emoji พร้อม fallback เป็น Unicode
// การใช้งานหลัก: buildEmojiProgressBar(value, max, { segments, onSkinName, offSkinName, onSkin, offSkin })

/**
 * โครงสกินสำหรับหลอดแบบแคปหัวท้ายและตัวกลาง
 * on = เติม, off = ว่าง
 */
const BluePillSkin = {
  // แทนที่ด้วยอีโมจิจริงของคุณ เช่น "<:bar_left_on:123456789012345678>"
  leftOn: "<:bar_left_on:0>",
  midOn: "<:bar_mid_on:0>",
  rightOn: "<:bar_right_on:0>",
  leftOff: "<:bar_left_off:0>",
  midOff: "<:bar_mid_off:0>",
  rightOff: "<:bar_right_off:0>",
  // สำหรับกรณีมีเพียง 1 ช่อง
  singleOn: null,
  singleOff: null,
};

/**
 * fallback แบบ Unicode ถ้าไม่มีสกิน
 */
const UnicodeSkin = {
  leftOn: "[",
  midOn: "█",
  rightOn: "]",
  leftOff: "[",
  midOff: " ░",
  rightOff: "]",
  singleOn: "[█]",
  singleOff: "[ ]",
};

// Registry สำหรับหลายสกิน (เช่น on1..on8, off1..off3)
const SkinRegistry = {
  default_on: BluePillSkin,
  default_off: BluePillSkin,
  unicode_on: UnicodeSkin,
  unicode_off: UnicodeSkin,
};

function registerSkin(name, skin) {
  SkinRegistry[name] = skin;
}

function getSkin(name, fallback) {
  return (name && SkinRegistry[name]) || fallback || BluePillSkin;
}

/**
 * สร้างสตริงหลอดแบบอีโมจิ
 * @param {number} value - ค่าปัจจุบัน
 * @param {number} max - ค่าสูงสุด
 * @param {object} opts
 * @param {number} [opts.segments=10]
 * @param {object} [opts.onSkin] - skin ที่ใช้กับช่องที่เติมแล้ว
 * @param {object} [opts.offSkin] - skin ที่ใช้กับช่องว่าง
 * @param {string} [opts.onSkinName]
 * @param {string} [opts.offSkinName]
 * @returns {string}
 */
function buildEmojiProgressBar(value, max, opts = {}) {
  const segments = Math.max(1, Math.floor(opts.segments || 10));
  const onSkin = opts.onSkin || getSkin(opts.onSkinName, BluePillSkin);
  const offSkin = opts.offSkin || getSkin(opts.offSkinName, BluePillSkin);

  const safe = (n) => (isFinite(n) ? n : 0);
  const pct = max > 0 ? Math.max(0, Math.min(1, safe(value) / safe(max))) : 0;
  const filled = Math.round(pct * segments);

  // กรณี segments = 1 ใช้ singleOn/singleOff ถ้ามี
  if (segments === 1) {
    const token = filled >= 1 ? (onSkin.singleOn || UnicodeSkin.singleOn) : (offSkin.singleOff || UnicodeSkin.singleOff);
    return token;
  }

  let out = "";
  const lastIndex = segments - 1;

  // left cap
  const leftFilled = filled > 0;
  out += leftFilled ? (onSkin.leftOn || UnicodeSkin.leftOn) : (offSkin.leftOff || UnicodeSkin.leftOff);

  // middle
  const midCount = Math.max(0, segments - 2);
  for (let i = 1; i <= midCount; i++) {
    const isFilled = i < filled;
    out += isFilled ? (onSkin.midOn || UnicodeSkin.midOn) : (offSkin.midOff || UnicodeSkin.midOff);
  }

  // right cap
  const rightFilled = filled > lastIndex;
  out += rightFilled ? (onSkin.rightOn || UnicodeSkin.rightOn) : (offSkin.rightOff || UnicodeSkin.rightOff);

  return out;
}

/**
 * บิลด์บาร์ 10 ขั้นแบบ 5 อีโมจิ (ซ้าย, กลางx3, ขวา) ด้วยสัดส่วน [3,2,2,2,1]
 * @param {number} value - ค่าปัจจุบัน 0..10
 * @param {object} T - ชุดอีโมจิของแต่ละตำแหน่ง
 * @param {object} T.left - { off, p1, p2, full }
 * @param {object} T.mid1 - { off, p1, full }
 * @param {object} T.mid2 - { off, p1, full }
 * @param {object} T.mid3 - { off, p1, full }
 * @param {object} T.right - { off, full }
 */
function buildBar10ByEmojiSet(value, T) {
  const v = Math.max(0, Math.min(10, Math.floor(value)));
  const parts = [];
  // โควตาต่อช่อง: ซ้าย=2, mid1=2, mid2=2, mid3=2, ขวา=2 (รวม 10)
  let rem = v;
  const use = (remUnits, node) => {
    if (remUnits <= 0) return node.off;
    if (remUnits === 1) return node.p1 || node.full; // ถ้าไม่มี p1 จะใช้ full แทน
    return node.full;
  };
  // left (2)
  parts.push(use(rem, T.left));
  rem = Math.max(0, rem - 2);
  // mid1 (2)
  parts.push(use(rem, T.mid1));
  rem = Math.max(0, rem - 2);
  // mid2 (2)
  parts.push(use(rem, T.mid2));
  rem = Math.max(0, rem - 2);
  // mid3 (2)
  parts.push(use(rem, T.mid3));
  rem = Math.max(0, rem - 2);
  // right (2)
  parts.push(use(rem, T.right));
  return parts.join("");
}

module.exports = {
  buildEmojiProgressBar,
  registerSkin,
  getSkin,
  BluePillSkin,
  UnicodeSkin,
  SkinRegistry,
  buildBar10ByEmojiSet,
}; 