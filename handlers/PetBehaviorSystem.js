const cron = require('node-cron');
const GPet = require("../settings/models/pet.js");

/**
 * ระบบจำลองพฤติกรรมสัตว์เลี้ยงที่สมบูรณ์
 * ใช้ค่าหลัก 4 ตัว: Fatigue, Affection, Fullness, Dirtiness
 * พร้อมระบบอารมณ์, ท่าทาง, อีโมต, และปฏิกิริยา
 */

// ค่าคงที่สำหรับระบบ
const STAT_RANGES = {
    MIN: 1,
    MAX: 20,
    DEFAULT: 20
};

// โหมดของสัตว์เลี้ยง
const PET_MODES = {
    IDLE: 'idle',      // เฉยๆ
    PLAY: 'play',      // เล่น
    SLEEP: 'sleep',    // นอน
    EAT: 'eat'         // กิน
};

// อารมณ์พื้นฐาน
const MOODS = {
    HAPPY: 'happy',
    SAD: 'sad',
    ANGRY: 'angry',
    BORED: 'bored',
    EXCITED: 'excited',
    CONTENT: 'content'
};

// ท่าทาง
const POSES = {
    IDLE: 'idle',
    SLEEP: 'sleep',
    ANGRY: 'angry',
    SEEP: 'seep',      // ซึมๆ
    PLAYING: 'playing'
};

// อีโมต
const EMOTES = {
    HAPPY: 'happy',
    HUNGRY: 'hungry',
    SLEEP: 'sleep',
    ANGRY: 'angry',
    SMELLY: 'smelly',
    PLAYING: 'playing',
    BORED: 'bored'
};

// ปฏิกิริยา (คำพูด)
const REACTIONS = {
    // ความหิว
    HUNGRY_START: "อยากกินข้าวแล้ว...",
    HUNGRY_VERY: "หิวมากเลย! ให้อาหารหน่อยได้ไหม?",
    
    // ความสกปรก
    DIRTY_START: "เหม็นจังเลยนะ 😠",
    DIRTY_VERY: "ตัวสกปรกมาก! อาบน้ำให้หน่อย!",
    
    // ความล้า
    TIRED_START: "เหนื่อยจัง...",
    TIRED_VERY: "ง่วงมาก! อยากนอนแล้ว",
    
    // ความเอ็นดู
    AFFECTION_LOW: "เจ้าของไม่สนใจฉันเลย...",
    AFFECTION_HIGH: "ชอบอยู่กับเจ้าของที่สุดเลย 💖",
    
    // การเล่น
    PLAY_START: "สนุกจัง! เล่นต่อได้ไหม?",
    PLAY_END: "ขอบคุณที่เล่นด้วย!",
    
    // การอาบน้ำ
    CLEAN_LIKE: "น้ำอุ่นดี! รู้สึกสดชื่น",
    CLEAN_DISLIKE: "น้ำเย็นไปหน่อย! แต่ก็ขอบคุณ",
    
    // การให้อาหาร
    FEED_GOOD: "อร่อยมาก! ขอบคุณ",
    FEED_TOO_MUCH: "อิ่มเกินไป... อยากนอน",
    
    // การนอน
    SLEEP_START: "ง่วงแล้ว... ไปนอนก่อน",
    SLEEP_END: "ตื่นแล้ว! รู้สึกดีขึ้น"
};

class PetBehaviorSystem {
    constructor() {
        this.isRunning = false;
        this.tickInterval = 60000; // 1 นาที
        this.lastTick = Date.now();
    }

    /**
     * เริ่มระบบพฤติกรรมสัตว์เลี้ยง
     */
    start() {
        if (this.isRunning) {
            console.log('[PET_BEHAVIOR] System already running');
            return;
        }

        console.log('[PET_BEHAVIOR] Starting pet behavior system...');
        
        // รันทุกๆ 1 นาที
        cron.schedule('* * * * *', async () => {
            try {
                await this.processTick();
            } catch (error) {
                console.error('[PET_BEHAVIOR] Error in tick processing:', error);
            }
        });

        this.isRunning = true;
        console.log('[PET_BEHAVIOR] Pet behavior system started');
    }

    /**
     * ประมวลผลทุก tick (1 นาที)
     */
    async processTick() {
        try {
            const pets = await GPet.find();
            console.log(`[PET_BEHAVIOR] Processing ${pets.length} pets...`);

            for (const pet of pets) {
                await this.updatePetBehavior(pet);
            }

            this.lastTick = Date.now();
        } catch (error) {
            console.error('[PET_BEHAVIOR] Error processing tick:', error);
        }
    }

    /**
     * อัปเดตพฤติกรรมของสัตว์เลี้ยงแต่ละตัว
     */
    async updatePetBehavior(pet) {
        try {
            // คำนวณโหมดปัจจุบัน
            const currentMode = this.determinePetMode(pet);
            
            // อัปเดตค่าหลักตามโหมด
            const updatedStats = this.updateStatsByMode(pet, currentMode);
            
            // คำนวณอารมณ์ใหม่
            const newMood = this.calculateMood(updatedStats);
            
            // คำนวณสุขภาพรวม
            const health = this.calculateHealth(updatedStats);
            
            // ตรวจสอบปฏิกิริยาใหม่
            const reactions = this.checkReactions(pet, updatedStats);
            
            // อัปเดตฐานข้อมูล
            await this.updatePetInDatabase(pet, updatedStats, newMood, health, reactions);
            
        } catch (error) {
            console.error(`[PET_BEHAVIOR] Error updating pet ${pet._id}:`, error);
        }
    }

    /**
     * กำหนดโหมดของสัตว์เลี้ยงตามสถานะปัจจุบัน
     */
    determinePetMode(pet) {
        const fatigue = Number(pet.fatigue || 0);
        const fullness = Number(pet.fullness || 0);
        const affection = Number(pet.affection || 0);

        // ถ้าเหนื่อยมาก → นอน
        if (fatigue >= 17) return PET_MODES.SLEEP;
        
        // ถ้าหิวมาก → กิน
        if (fullness <= 4) return PET_MODES.EAT;
        
        // ถ้าเอ็นดูต่ำ → เล่น
        if (affection <= 6) return PET_MODES.PLAY;
        
        // อื่นๆ → เฉยๆ
        return PET_MODES.IDLE;
    }

    /**
     * อัปเดตค่าหลักตามโหมด
     */
    updateStatsByMode(pet, mode) {
        const stats = {
            fatigue: Number(pet.fatigue || 0),
            affection: Number(pet.affection || 0),
            fullness: Number(pet.fullness || 0),
            dirtiness: Number(pet.dirtiness || 0)
        };

        // ตรวจสอบว่าสัตว์กำลังนอนหรือไม่
        if (pet.isSleeping) {
            // ระหว่างนอน: ไม่เพิ่ม fatigue, ลด fullness ช้า, เพิ่ม dirtiness ช้า
            stats.fullness = Math.max(STAT_RANGES.MIN, stats.fullness - 0.1);
            stats.dirtiness = Math.min(STAT_RANGES.MAX, stats.dirtiness + 0.05);
            // fatigue ไม่เปลี่ยนแปลงระหว่างนอน
            return stats;
        }

        switch (mode) {
            case PET_MODES.IDLE:
                // เฉยๆ: ความอิ่มลดช้า, ความล้าเพิ่มช้า
                stats.fullness = Math.max(STAT_RANGES.MIN, stats.fullness - 0.5);
                stats.fatigue = Math.min(STAT_RANGES.MAX, stats.fatigue + 0.3);
                stats.dirtiness = Math.min(STAT_RANGES.MAX, stats.dirtiness + 0.2);
                break;

            case PET_MODES.PLAY:
                // เล่น: ความล้าเพิ่มเร็ว, ความสกปรกเพิ่มเร็ว, แต่ affection เพิ่มขึ้น
                stats.fatigue = Math.min(STAT_RANGES.MAX, stats.fatigue + 1.2);
                stats.dirtiness = Math.min(STAT_RANGES.MAX, stats.dirtiness + 0.8);
                stats.affection = Math.min(STAT_RANGES.MAX, stats.affection + 0.5);
                stats.fullness = Math.max(STAT_RANGES.MIN, stats.fullness - 0.3);
                break;

            case PET_MODES.SLEEP:
                // นอน: ความล้าลดลง, ความอิ่มลดลงช้า, ความสกปรกเพิ่มช้า
                stats.fatigue = Math.max(STAT_RANGES.MIN, stats.fatigue - 2.0);
                stats.fullness = Math.max(STAT_RANGES.MIN, stats.fullness - 0.2);
                stats.dirtiness = Math.min(STAT_RANGES.MAX, stats.dirtiness + 0.1);
                break;

            case PET_MODES.EAT:
                // กิน: ความอิ่มเพิ่มขึ้น, ความล้าลดลงเล็กน้อย
                stats.fullness = Math.min(STAT_RANGES.MAX, stats.fullness + 1.0);
                stats.fatigue = Math.max(STAT_RANGES.MIN, stats.fatigue - 0.2);
                break;
        }

        // ตรวจสอบขอบเขต
        stats.fatigue = Math.max(STAT_RANGES.MIN, Math.min(STAT_RANGES.MAX, Math.round(stats.fatigue)));
        stats.affection = Math.max(STAT_RANGES.MIN, Math.min(STAT_RANGES.MAX, Math.round(stats.affection)));
        stats.fullness = Math.max(STAT_RANGES.MIN, Math.min(STAT_RANGES.MAX, Math.round(stats.fullness)));
        stats.dirtiness = Math.max(STAT_RANGES.MIN, Math.min(STAT_RANGES.MAX, Math.round(stats.dirtiness)));

        return stats;
    }

    /**
     * คำนวณอารมณ์จากค่าหลัก
     */
    calculateMood(stats) {
        const { fatigue, affection, fullness, dirtiness } = stats;

        // ถ้าหิวมากหรือถูกละเลยนาน → เศร้า
        if (fullness <= 4 || affection <= 3) return MOODS.SAD;
        
        // ถ้าสกปรกหรือเหนื่อยนานเกินไป → โกรธ
        if (dirtiness >= 15 || fatigue >= 16) return MOODS.ANGRY;
        
        // ถ้าอาบน้ำหรือเล่นบ่อย → มีความสุข
        if (affection >= 15 && fullness >= 12 && dirtiness <= 5) return MOODS.HAPPY;
        
        // ถ้าไม่มีอะไรเกิดขึ้นเลยนานมาก → เบื่อ
        if (fatigue <= 3 && affection <= 8 && fullness >= 15) return MOODS.BORED;
        
        // ถ้าพร้อมเล่น → ตื่นเต้น
        if (affection >= 10 && fatigue <= 8) return MOODS.EXCITED;
        
        // อื่นๆ → พอใจ
        return MOODS.CONTENT;
    }

    /**
     * คำนวณสุขภาพรวมจากค่าหลักทั้งหมด
     */
    calculateHealth(stats) {
        const { fatigue, affection, fullness, dirtiness } = stats;
        
        // คำนวณคะแนนสุขภาพ (1-20)
        const fatigueScore = (STAT_RANGES.MAX - fatigue) / STAT_RANGES.MAX;
        const affectionScore = affection / STAT_RANGES.MAX;
        const fullnessScore = fullness / STAT_RANGES.MAX;
        const cleanlinessScore = (STAT_RANGES.MAX - dirtiness) / STAT_RANGES.MAX;
        
        const healthScore = (fatigueScore + affectionScore + fullnessScore + cleanlinessScore) / 4;
        return Math.round(healthScore * STAT_RANGES.MAX);
    }

    /**
     * ตรวจสอบปฏิกิริยาใหม่
     */
    checkReactions(pet, newStats) {
        const reactions = [];
        const oldStats = {
            fatigue: Number(pet.fatigue || 0),
            affection: Number(pet.affection || 0),
            fullness: Number(pet.fullness || 0),
            dirtiness: Number(pet.dirtiness || 0)
        };

        // ตรวจสอบการเปลี่ยนแปลงที่สำคัญ
        if (newStats.fullness <= 4 && oldStats.fullness > 4) {
            reactions.push(REACTIONS.HUNGRY_START);
        }
        if (newStats.fullness <= 2 && oldStats.fullness > 2) {
            reactions.push(REACTIONS.HUNGRY_VERY);
        }

        if (newStats.dirtiness >= 15 && oldStats.dirtiness < 15) {
            reactions.push(REACTIONS.DIRTY_START);
        }
        if (newStats.dirtiness >= 17 && oldStats.dirtiness < 17) {
            reactions.push(REACTIONS.DIRTY_VERY);
        }

        if (newStats.fatigue >= 15 && oldStats.fatigue < 15) {
            reactions.push(REACTIONS.TIRED_START);
        }
        if (newStats.fatigue >= 17 && oldStats.fatigue < 17) {
            reactions.push(REACTIONS.TIRED_VERY);
        }

        if (newStats.affection <= 3 && oldStats.affection > 3) {
            reactions.push(REACTIONS.AFFECTION_LOW);
        }
        if (newStats.affection >= 17 && oldStats.affection < 17) {
            reactions.push(REACTIONS.AFFECTION_HIGH);
        }

        return reactions;
    }

    /**
     * อัปเดตข้อมูลสัตว์เลี้ยงในฐานข้อมูล
     */
    async updatePetInDatabase(pet, stats, mood, health, reactions) {
        try {
            const updateData = {
                fatigue: stats.fatigue,
                affection: stats.affection,
                fullness: stats.fullness,
                dirtiness: stats.dirtiness,
                mood: mood,
                health: health,
                lastUpdate: new Date()
            };

            // เพิ่มปฏิกิริยาใหม่ (ถ้ามี)
            if (reactions.length > 0) {
                updateData.lastReactions = reactions;
                updateData.lastReactionTime = new Date();
            }

            await GPet.updateOne(
                { _id: pet._id },
                { $set: updateData }
            );

            console.log(`[PET_BEHAVIOR] Updated pet ${pet._id}:`, {
                fatigue: stats.fatigue,
                affection: stats.affection,
                fullness: stats.fullness,
                dirtiness: stats.dirtiness,
                mood: mood,
                health: health,
                reactions: reactions.length
            });

        } catch (error) {
            console.error(`[PET_BEHAVIOR] Error updating pet ${pet._id} in database:`, error);
        }
    }

    /**
     * ประมวลผลการกระทำของผู้เล่น
     */
    async processPlayerAction(petId, action, params = {}) {
        try {
            const pet = await GPet.findById(petId);
            if (!pet) {
                throw new Error('Pet not found');
            }

            const reactions = [];
            const stats = {
                fatigue: Number(pet.fatigue || 0),
                affection: Number(pet.affection || 0),
                fullness: Number(pet.fullness || 0),
                dirtiness: Number(pet.dirtiness || 0)
            };

            switch (action) {
                case 'feed':
                    // ให้อาหาร: เพิ่มความอิ่มและ affection เล็กน้อย
                    stats.fullness = Math.min(STAT_RANGES.MAX, stats.fullness + 5);
                    stats.affection = Math.min(STAT_RANGES.MAX, stats.affection + 1);
                    
                    if (stats.fullness >= 18) {
                        reactions.push(REACTIONS.FEED_TOO_MUCH);
                    } else {
                        reactions.push(REACTIONS.FEED_GOOD);
                    }
                    break;

                case 'clean':
                    // ทำความสะอาด: ลดความสกปรก
                    const oldDirtiness = stats.dirtiness;
                    stats.dirtiness = Math.max(STAT_RANGES.MIN, stats.dirtiness - 8);
                    
                    // มีโอกาส 20% ที่สัตว์จะไม่ชอบอาบน้ำ
                    if (Math.random() < 0.2) {
                        reactions.push(REACTIONS.CLEAN_DISLIKE);
                    } else {
                        reactions.push(REACTIONS.CLEAN_LIKE);
                        stats.affection = Math.min(STAT_RANGES.MAX, stats.affection + 1);
                    }
                    break;

                case 'play':
                    // เล่นด้วย: เพิ่ม affection มาก แต่ทำให้เหนื่อยและสกปรก
                    stats.affection = Math.min(STAT_RANGES.MAX, stats.affection + 3);
                    stats.fatigue = Math.min(STAT_RANGES.MAX, stats.fatigue + 2);
                    stats.dirtiness = Math.min(STAT_RANGES.MAX, stats.dirtiness + 1);
                    stats.fullness = Math.max(STAT_RANGES.MIN, stats.fullness - 1);
                    
                    reactions.push(REACTIONS.PLAY_START);
                    break;

                case 'sleep':
                    // นอน: ลดความล้าอย่างรวดเร็ว
                    stats.fatigue = Math.max(STAT_RANGES.MIN, stats.fatigue - 5);
                    stats.fullness = Math.max(STAT_RANGES.MIN, stats.fullness - 1);
                    
                    reactions.push(REACTIONS.SLEEP_START);
                    break;
            }

            // คำนวณอารมณ์และสุขภาพใหม่
            const newMood = this.calculateMood(stats);
            const health = this.calculateHealth(stats);

            // อัปเดตฐานข้อมูล
            await this.updatePetInDatabase(pet, stats, newMood, health, reactions);

            return {
                success: true,
                stats: stats,
                mood: newMood,
                health: health,
                reactions: reactions
            };

        } catch (error) {
            console.error(`[PET_BEHAVIOR] Error processing player action:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * หยุดระบบ
     */
    stop() {
        if (this.isRunning) {
            this.isRunning = false;
            console.log('[PET_BEHAVIOR] Pet behavior system stopped');
        }
    }
}

// สร้าง instance เดียว
const petBehaviorSystem = new PetBehaviorSystem();

module.exports = {
    PetBehaviorSystem,
    petBehaviorSystem,
    STAT_RANGES,
    PET_MODES,
    MOODS,
    POSES,
    EMOTES,
    REACTIONS
};
