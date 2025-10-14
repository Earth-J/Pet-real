const DEFAULT_EMOTION = 'happy';

/**
 * ระบบอีโมต (Emote) ที่สมบูรณ์
 * ใช้ค่าหลัก 4 ตัว: Fatigue, Affection, Fullness, Dirtiness
 * 
 * อีโมตคือ "ฟองความคิด" หรือ "อารมณ์แสดงบนหัว" ที่เด่นที่สุดในขณะนั้น
 * 
 * ลำดับความสำคัญ:
 * 1. fullness ต่ำมาก → hungry
 * 2. fatigue สูงมาก → sleep  
 * 3. dirtiness ≥17 → smelly (สุดสกปรก)
 * 4. dirtiness ≥13 → angry (หงุดหงิดเพราะตัวเลอะ)
 * 5. affection ต่ำมาก → angry (ไม่พอใจเจ้าของ)
 * 6. affection สูงมาก + ไม่เหนื่อย → playing หรือ happy
 * 7. อื่นๆ → happy (ปกติ)
 */
function getEmotionKey(petDoc) {
  if (!petDoc) return DEFAULT_EMOTION;

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

  // ลำดับการตัดสินใจตามความสำคัญ (จากมากไปน้อย)
  
  // 1. fullness ต่ำมาก → hungry
  if (fullness <= 4) return 'hungry';
  
  // 2. fatigue สูงมาก → sleep
  if (fatigue >= 17) return 'sleep';
  
  // 3. dirtiness ≥17 → smelly (สุดสกปรก)
  if (dirtiness >= 17) return 'smelly';
  
  // 4. dirtiness ≥13 → angry (หงุดหงิดเพราะตัวเลอะ)
  if (dirtiness >= 13) return 'angry';
  
  // 5. affection ต่ำมาก → angry (ไม่พอใจเจ้าของ)
  if (affection <= 3) return 'angry';
  
  // 6. affection สูงมาก + ไม่เหนื่อย → playing หรือ happy
  if (affection >= 15 && fatigue <= 8) {
    // ถ้า affection สูงมาก + fatigue ต่ำ → playing
    if (affection >= 17 && fatigue <= 5) return 'playing';
    // อื่นๆ → happy
    return 'happy';
  }
  
  // 7. อื่นๆ → happy (ปกติ)
  return DEFAULT_EMOTION;
}

/**
 * ตรวจสอบว่าอีโมตเปลี่ยนหรือไม่
 */
function hasEmotionChanged(oldEmotion, newEmotion) {
  return oldEmotion !== newEmotion;
}

/**
 * ได้รับคำอธิบายอีโมตเป็นภาษาไทย
 */
function getEmotionDescription(emotionKey) {
  const descriptions = {
    'happy': 'มีความสุข',
    'hungry': 'หิว',
    'sleep': 'ง่วงนอน',
    'angry': 'โกรธ',
    'smelly': 'เหม็นมาก',
    'playing': 'เล่น',
    'bored': 'เบื่อ',
    'idle': 'เฉยๆ'
  };
  return descriptions[emotionKey] || 'ไม่ทราบ';
}

/**
 * ได้รับคำแนะนำตามอีโมต
 */
function getEmotionAdvice(emotionKey) {
  const advice = {
    'happy': 'สัตว์เลี้ยงมีความสุข ควรรักษาสถานะนี้ไว้',
    'hungry': 'สัตว์เลี้ยงหิว ควรให้อาหาร',
    'sleep': 'สัตว์เลี้ยงง่วง ควรให้พักผ่อน',
    'angry': 'สัตว์เลี้ยงโกรธ ควรเล่นด้วยหรือทำความสะอาด',
    'smelly': 'สัตว์เลี้ยงเหม็นมาก ควรอาบน้ำทันที',
    'playing': 'สัตว์เลี้ยงพร้อมเล่น ควรเล่นด้วย',
    'bored': 'สัตว์เลี้ยงเบื่อ ควรเล่นด้วยหรือให้อาหาร',
    'idle': 'สัตว์เลี้ยงเฉยๆ ควรดูแลตามปกติ'
  };
  return advice[emotionKey] || 'ควรดูแลสัตว์เลี้ยงตามปกติ';
}

/**
 * ได้รับอีโมจิสำหรับอีโมต
 */
function getEmotionEmoji(emotionKey) {
  const emojis = {
    'happy': '😄',
    'hungry': '🍖',
    'sleep': '💤',
    'angry': '😡',
    'smelly': '🧼',
    'playing': '🎾',
    'bored': '😴',
    'idle': '🐾'
  };
  return emojis[emotionKey] || '🐾';
}

/**
 * ตรวจสอบว่าอีโมตนี้แสดงความต้องการเร่งด่วนหรือไม่
 */
function isUrgentEmotion(emotionKey) {
  const urgentEmotions = ['hungry', 'angry', 'smelly'];
  return urgentEmotions.includes(emotionKey);
}

/**
 * ตรวจสอบว่าอีโมตนี้แสดงความสุขหรือไม่
 */
function isPositiveEmotion(emotionKey) {
  const positiveEmotions = ['happy', 'playing'];
  return positiveEmotions.includes(emotionKey);
}

module.exports = { 
  getEmotionKey, 
  hasEmotionChanged, 
  getEmotionDescription, 
  getEmotionAdvice,
  getEmotionEmoji,
  isUrgentEmotion,
  isPositiveEmotion
}; 