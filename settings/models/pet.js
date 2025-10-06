const { Schema, model } = require('mongoose');

const pet = Schema({
    guild: String,
    user: String,
    name: String,
    type: String,
    id: String,
    price: Number,
    exp: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    nextexp: { type: Number, default: 100 },
    // ค่ารุ่นเก่า (คงไว้เพื่อ backward compatibility)
    health: { type: Number, default: 20 },
    hungry: { type: Number, default: 20 },
    sleep: { type: Number, default: 20 },
    cleanliness: { type: Number, default: 20 },
    // ค่ารุ่นใหม่
    affection: { type: Number, default: 20 },      // 0..20 (สูง = เอ็นดูมาก)
    fullness: { type: Number, default: 20 },       // 0..20 (ต่ำ = หิว)
    dirtiness: { type: Number, default: 0 },       // 0..20 (สูง = สกปรก)
    fatigue: { type: Number, default: 0 },          // 0..20 (สูง = ง่วง/ล้า)
    // Fire Streak System
    fireStreak: { type: Number, default: 0 },      // ความต่อเนื่องในการดูแล pet
    lastActivityDate: { type: String, default: '' }, // วันที่ใช้งานล่าสุด (YYYY-MM-DD)
    
    // ระบบพฤติกรรมสัตว์เลี้ยง
    mood: { type: String, default: 'content' },    // อารมณ์พื้นฐาน (happy, sad, angry, bored, excited, content)
    lastEmotion: { type: String, default: 'happy' }, // อีโมตล่าสุด (happy, hungry, sleep, angry, smelly, playing, bored, idle)
    lastPose: { type: String, default: 'idle' },   // ท่าทางล่าสุด (idle, sleep, angry, seep, playing)
    health: { type: Number, default: 20 },         // สุขภาพรวม (1-20)
    healthStatus: { type: String, default: 'excellent' }, // สถานะสุขภาพ (excellent, good, fair, poor, critical)
    
    // ระบบปฏิกิริยาและคำแนะนำ
    lastReactions: { type: [String], default: [] }, // ปฏิกิริยาล่าสุด
    lastReactionTime: { type: Date, default: null }, // เวลาปฏิกิริยาล่าสุด
    careRecommendations: { type: [Object], default: [] }, // คำแนะนำการดูแล
    
    // ระบบการกระทำผู้เล่น
    lastPlayerAction: { type: String, default: '' }, // การกระทำล่าสุดของผู้เล่น
    lastPlayerActionTime: { type: Date, default: null }, // เวลาการกระทำล่าสุด
    
  // ระบบเวลา
  lastUpdate: { type: Date, default: Date.now }, // เวลาอัปเดตล่าสุด
  lastTick: { type: Number, default: 0 },        // หมายเลข tick ล่าสุด
  
  // ระบบการนอน
  isSleeping: { type: Boolean, default: false },  // กำลังนอนหรือไม่
  sleepStartTime: { type: Date, default: null },  // เวลาเริ่มนอน
  sleepDuration: { type: Number, default: 0 },    // ระยะเวลานอน (นาที)
  lastSleepTime: { type: Date, default: null },   // เวลานอนล่าสุด
  lastWakeTime: { type: Date, default: null },    // เวลาตื่นล่าสุด
    
    // media
    spriteGifUrl: { type: String, default: '' }
});

// ดัชนีเพื่อให้ค้นหา pet ต่อผู้ใช้ในกิลด์ได้เร็วขึ้น และป้องกันสร้างซ้ำ
pet.index({ guild: 1, user: 1 }, { unique: true });

module.exports = model('pets', pet);

