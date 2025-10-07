const { getEmotionKey } = require('./petEmotion');

const DEFAULT_POSE = 'idle';

/**
 * ระบบท่าทาง (Pose) ที่สมบูรณ์
 * ใช้ค่าหลัก 4 ตัว: Fatigue, Affection, Fullness, Dirtiness
 * 
 * ท่าทางจะถูกเลือกโดยอัตโนมัติตามเงื่อนไข:
 * - sleep: fatigue >= 17 (นอนหลับ)
 * - seep: fatigue 13-16 (ง่วง)
 * - angry: dirtiness >= 15 หรือ affection <= 3 (โกรธ)
 * - playing: affection สูง + fatigue ต่ำ (เล่น)
 * - idle: ท่าปกติ (ยืนปกติ)
 */
function getPoseKey(petDoc) {
  if (!petDoc) return DEFAULT_POSE;

  // Fallback สำหรับข้อมูลเก่า: แปลงจากระบบเก่าเป็นระบบใหม่
  let affection, fullness, dirtiness, fatigue;
  
  if (typeof petDoc.affection !== 'undefined') {
    // ใช้ระบบใหม่
    affection = Number(petDoc.affection ?? 0);
    fullness = Number(petDoc.fullness ?? 0);
    dirtiness = Number(petDoc.dirtiness ?? 0);
    fatigue = Number(petDoc.fatigue ?? 0);
  } else {
    // ใช้ระบบเก่า + แปลงเป็นระบบใหม่
    affection = Number(petDoc.health ?? 20);           // health → affection
    fullness = Number(petDoc.hungry ?? 20);            // hungry → fullness
    dirtiness = Math.max(0, 20 - Number(petDoc.cleanliness ?? 20)); // cleanliness → dirtiness (inverted)
    fatigue = Math.max(0, 20 - Number(petDoc.sleep ?? 20));       // sleep → fatigue (inverted)
  }

  // ลำดับการตัดสินใจตามความสำคัญ
  
  // 1. ถ้า fatigue สูงมาก (≥17) → ท่านอนหลับ
  if (fatigue >= 17) return 'sleep';
  
  // 2. ถ้า fatigue ค่อนข้างสูง (13–16) → ท่าง่วง (seep)
  if (fatigue >= 13 && fatigue < 17) return 'seep';
  
  // 3. ถ้า dirtiness ≥ 15 → ท่าโกรธ (angry)
  if (dirtiness >= 15) return 'angry';
  
  // 4. ถ้า affection ≤ 3 → โกรธเพราะโดนละเลย (angry)
  if (affection <= 3) return 'angry';
  
  // 5. ถ้า affection สูง + fatigue ต่ำ → ท่าเล่น
  if (affection >= 14 && fatigue <= 6) return 'playing';
  
  // 6. ถ้าไม่เข้าเงื่อนไขใด → ท่ายืนปกติ (idle)
  return DEFAULT_POSE;
}

/**
 * ตรวจสอบว่าท่าทางเปลี่ยนหรือไม่
 */
function hasPoseChanged(oldPose, newPose) {
  return oldPose !== newPose;
}

/**
 * ได้รับคำอธิบายท่าทางเป็นภาษาไทย
 */
function getPoseDescription(poseKey) {
  const descriptions = {
    'idle': 'ยืนปกติ',
    'sleep': 'นอนหลับ',
    'seep': 'ง่วงนอน',
    'angry': 'โกรธ',
    'playing': 'เล่น'
  };
  return descriptions[poseKey] || 'ไม่ทราบ';
}

/**
 * ได้รับคำแนะนำตามท่าทาง
 */
function getPoseAdvice(poseKey) {
  const advice = {
    'idle': 'สัตว์เลี้ยงอยู่ในสภาพปกติ',
    'sleep': 'สัตว์เลี้ยงกำลังนอนหลับ ควรให้พักผ่อน',
    'seep': 'สัตว์เลี้ยงดูง่วง ควรให้พักผ่อนหรือเล่นเบาๆ',
    'angry': 'สัตว์เลี้ยงโกรธ ควรเล่นด้วยหรือทำความสะอาด',
    'playing': 'สัตว์เลี้ยงพร้อมเล่น ควรเล่นด้วยเพื่อเพิ่มความสุข'
  };
  return advice[poseKey] || 'ควรดูแลสัตว์เลี้ยงตามปกติ';
}

module.exports = { 
  getPoseKey, 
  hasPoseChanged, 
  getPoseDescription, 
  getPoseAdvice 
}; 
