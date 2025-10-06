const cron = require('node-cron');
const GPet = require("../settings/models/pet.js");

/**
 * ระบบจำลองพฤติกรรมสัตว์เลี้ยงที่สมบูรณ์
 * ใช้ค่าหลัก 4 ตัว: Fatigue, Affection, Fullness, Dirtiness
 * พร้อมระบบอารมณ์, ท่าทาง, อีโมต, และปฏิกิริยา
 * 
 * หมายเหตุ: ระบบนี้ถูกปิดการใช้งานแล้ว (DISABLED) เพื่อป้องกันการซ้ำซ้อนกับ PetGameLoop
 * ยังคงใช้ processPlayerAction() สำหรับการกระทำของผู้เล่น (feed, clean, play, sleep)
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
    HUNGRY_START: [
        "สัตว์เลี้ยงเริ่มมองหาชามอาหาร",
        "เดินวนบริเวณจุดให้อาหาร",
        "เลียปากและจ้องเจ้าของ"
    ],
    HUNGRY_VERY: [
        "ร้องเสียงดังและข่วนภาชนะอาหาร",
        "เข้าใกล้เจ้าของพร้อมส่งเสียงเรียก",
        "น้ำลายไหลและจ้องอาหารไม่ละสายตา"
    ],

    // ความสกปรก
    DIRTY_START: [
        "สะบัดตัวและเลียขนบ่อยขึ้น",
        "ขยับตัวไม่สบายและเริ่มหงุดหงิด",
        "พยายามปัดฝุ่นหรือคราบออกจากตัว"
    ],
    DIRTY_VERY: [
        "สั่นขนแรงและพยายามหนีจากจุดที่สกปรก",
        "ข่วนตัวแรงขึ้นและส่งเสียงไม่พอใจ",
        "กระโดดหลบเมื่อเจอน้ำหรือดินเปื้อน"
    ],

    // ความล้า
    TIRED_START: [
        "นั่งพักและหาวเบาๆ",
        "เดินช้าลงและเริ่มหมอบพัก",
        "ขยี้ตาเล็กน้อยก่อนนอน"
    ],
    TIRED_VERY: [
        "ล้มตัวลงนอนทันที",
        "ขยับหางช้าและหลับสนิท",
        "นอนขดตัวแน่นและไม่ตอบสนอง"
    ],

    // ความเอ็นดู (Affection)
    AFFECTION_LOW: [
        "นั่งห่างจากเจ้าของและจ้องอยู่เงียบๆ",
        "เดินวนใกล้ๆ แล้วหยุดนิ่ง",
        "ลังเลที่จะเข้าใกล้เจ้าของ"
    ],
    AFFECTION_HIGH: [
        "กระดิกหางและอิงตัวกับเจ้าของ",
        "ส่งเสียงเบาและเลียมือเจ้าของ",
        "กลิ้งตัวเมื่อถูกลูบหัว"
    ],

    // การเล่น
    PLAY_START: [
        "กระโดดและวิ่งรอบเจ้าของ",
        "ส่งเสียงร่าเริงและกระดิกหางแรง",
        "คาบของเล่นมาวางต่อหน้า"
    ],
    PLAY_END: [
        "นั่งหอบเบาๆ หลังจากเล่น",
        "กลิ้งตัวลงบนพื้นอย่างพอใจ",
        "ขดตัวพักและกระดิกหางเบาๆ"
    ],

    // การอาบน้ำ
    CLEAN_LIKE: [
        "สั่นขนหลังอาบน้ำและเดินเข้าหาเจ้าของ",
        "ยืดตัวและเดินไปมาอย่างสบาย",
        "กระดิกหางแรง ดูสดชื่น"
    ],
    CLEAN_DISLIKE: [
        "พยายามหนีจากน้ำและสะบัดตัวแรง",
        "สั่นขนแรงและเดินหลบมุม",
        "เลียขนแรงเพื่อให้แห้งเร็ว"
    ],

    // การให้อาหาร
    FEED_GOOD: [
        "รีบกินจนหมดและเลียชาม",
        "กระดิกหางแรงหลังจากกินเสร็จ",
        "นั่งพักด้วยท่าทีพอใจ"
    ],
    FEED_TOO_MUCH: [
        "นอนหมอบและหาวหลังจากกินมากเกินไป",
        "เดินช้าและนอนตะแคงพัก",
        "ขดตัวแน่นเหมือนท้องอิ่มจัด"
    ],

    // การนอน
    SLEEP_START: [
        "ปิดตาช้าๆ และขดตัวในที่นุ่ม",
        "ยืดตัวก่อนล้มตัวลงนอน",
        "หาวแล้วค่อยๆ หลับตา"
    ],
    SLEEP_END: [
        "ลุกขึ้นและยืดตัวเบาๆ",
        "ส่ายหัวเล็กน้อยก่อนเดินหาเจ้าของ",
        "ส่งเสียงสั้นๆ คล้ายทักทาย"
    ]
};



function pickReaction(key) {
    const value = REACTIONS[key];
    if (Array.isArray(value)) {
        const idx = Math.floor(Math.random() * value.length);
        return value[idx];
    }
    return value;
}

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
        // ถ้ากำลังนอนอยู่ → ใช้โหมดนอน
        if (pet.isSleeping) return PET_MODES.SLEEP;

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
            reactions.push(pickReaction('HUNGRY_START'));
        }
        if (newStats.fullness <= 2 && oldStats.fullness > 2) {
            reactions.push(pickReaction('HUNGRY_VERY'));
        }

        if (newStats.dirtiness >= 15 && oldStats.dirtiness < 15) {
            reactions.push(pickReaction('DIRTY_START'));
        }
        if (newStats.dirtiness >= 17 && oldStats.dirtiness < 17) {
            reactions.push(pickReaction('DIRTY_VERY'));
        }

        if (newStats.fatigue >= 15 && oldStats.fatigue < 15) {
            reactions.push(pickReaction('TIRED_START'));
        }
        if (newStats.fatigue >= 17 && oldStats.fatigue < 17) {
            reactions.push(pickReaction('TIRED_VERY'));
        }

        if (newStats.affection <= 3 && oldStats.affection > 3) {
            reactions.push(pickReaction('AFFECTION_LOW'));
        }
        if (newStats.affection >= 17 && oldStats.affection < 17) {
            reactions.push(pickReaction('AFFECTION_HIGH'));
        }

        return reactions;
    }

    /**
     * อัปเดตข้อมูลสัตว์เลี้ยงในฐานข้อมูล
     */
    async updatePetInDatabase(pet, stats, mood, health, reactions, exp = null, level = null, nextexp = null) {
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

            // เพิ่ม EXP และ Level (ถ้ามีการส่งมา)
            if (exp !== null) {
                updateData.exp = exp;
            }
            if (level !== null) {
                updateData.level = level;
            }
            if (nextexp !== null) {
                updateData.nextexp = nextexp;
            }

            // เพิ่มปฏิกิริยาใหม่ (ถ้ามี)
            if (reactions.length > 0) {
                updateData.lastReactions = reactions;
                updateData.lastReactionTime = new Date();
            }

            await GPet.updateOne(
                { _id: pet._id },
                { $set: updateData }
            );

            const logData = {
                fatigue: stats.fatigue,
                affection: stats.affection,
                fullness: stats.fullness,
                dirtiness: stats.dirtiness,
                mood: mood,
                health: health,
                reactions: reactions.length
            };

            if (exp !== null) logData.exp = exp;
            if (level !== null) logData.level = level;
            if (nextexp !== null) logData.nextexp = nextexp;

            console.log(`[PET_BEHAVIOR] Updated pet ${pet._id}:`, logData);

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

            // ตรวจสอบความเหนื่อยล้า - ถ้าเหนื่อยมากจะได้ผลน้อยลง
            const fatigueMultiplier = stats.fatigue >= 15 ? 0.5 : 1.0; // ถ้าเหนื่อย >= 15 จะได้ผลแค่ 50%
            const isTired = stats.fatigue >= 15;

            // กำหนด EXP ที่จะได้รับตาม action
            let expGain = 0;

            switch (action) {
                case 'feed':
                    // ให้อาหาร: เพิ่มความอิ่ม +4 และ affection +1, EXP +1 (หรือใช้ bonus จากอาหาร)
                    expGain = params.expBonus || 1; // ใช้ EXP จากอาหารถ้ามี ไม่งั้นใช้ default +1
                    const fullnessGain = Math.round(4 * fatigueMultiplier); // ลดจาก 5 → 4
                    const affectionGainFeed = Math.round(1 * fatigueMultiplier);
                    
                    stats.fullness = Math.min(STAT_RANGES.MAX, stats.fullness + fullnessGain);
                    stats.affection = Math.min(STAT_RANGES.MAX, stats.affection + affectionGainFeed);
                    
                    if (stats.fullness >= 18) {
                        reactions.push(pickReaction('FEED_TOO_MUCH'));
                    } else if (isTired) {
                        reactions.push("กินได้แต่ยังง่วงนอนอยู่... 😴");
                    } else {
                        reactions.push(pickReaction('FEED_GOOD'));
                    }
                    break;

                case 'clean':
                    // ทำความสะอาด: ลดความสกปรก -10 (หรือ -6 ถ้าเหนื่อย), EXP +2
                    expGain = 2;
                    const cleanAmount = isTired ? 6 : 10; // ชัดเจน: ไม่เหนื่อย = 10, เหนื่อย = 6
                    stats.dirtiness = Math.max(STAT_RANGES.MIN, stats.dirtiness - cleanAmount);
                    
                    // มีโอกาส 20% ที่สัตว์จะไม่ชอบอาบน้ำ
                    if (Math.random() < 0.2) {
                        reactions.push(pickReaction('CLEAN_DISLIKE'));
                    } else {
                        if (isTired) {
                            reactions.push("อาบน้ำแล้วยังง่วงอยู่... 😴");
                        } else {
                            reactions.push(pickReaction('CLEAN_LIKE'));
                        }
                        const affectionGainClean = Math.round(1 * fatigueMultiplier);
                        stats.affection = Math.min(STAT_RANGES.MAX, stats.affection + affectionGainClean);
                    }
                    break;

                case 'play':
                    // เล่นด้วย: เพิ่ม affection +3, เหนื่อย +1, EXP +3
                    expGain = 3;
                    const affectionGainPlay = Math.round(3 * fatigueMultiplier);
                    const fatigueGainPlay = isTired ? 2 : 1;
                    
                    stats.affection = Math.min(STAT_RANGES.MAX, stats.affection + affectionGainPlay);
                    stats.fatigue = Math.min(STAT_RANGES.MAX, stats.fatigue + fatigueGainPlay);
                    stats.dirtiness = Math.min(STAT_RANGES.MAX, stats.dirtiness + 1);
                    stats.fullness = Math.max(STAT_RANGES.MIN, stats.fullness - 1);
                    
                    if (isTired) {
                        reactions.push("เล่นได้นิดหน่อย... เหนื่อยมากแล้ว 😴");
                    } else {
                        reactions.push(pickReaction('PLAY_START'));
                    }
                    break;

                case 'walk':
                    // พาเดินเล่น: เพิ่ม affection +2, เหนื่อยน้อย +0.5, EXP +2
                    expGain = 2;
                    const affectionGainWalk = Math.round(2 * fatigueMultiplier); // เพิ่มจาก 1 → 2
                    const fatigueGainWalk = isTired ? 1 : 0.5; // ลดความเหนื่อย
                    
                    stats.affection = Math.min(STAT_RANGES.MAX, stats.affection + affectionGainWalk);
                    stats.fatigue = Math.min(STAT_RANGES.MAX, stats.fatigue + fatigueGainWalk);
                    stats.dirtiness = Math.min(STAT_RANGES.MAX, stats.dirtiness + 0.5);
                    stats.fullness = Math.max(STAT_RANGES.MIN, stats.fullness - 0.5);
                    
                    if (isTired) {
                        reactions.push("เดินได้นิดหน่อย... เหนื่อยมากแล้ว 😴");
                    } else {
                        reactions.push("เดินเล่นสนุกดี! เห็นทิวทัศน์สวยๆ 🌳");
                    }
                    break;

                case 'sleep':
                    // นอน: ไม่เพิ่ม EXP ที่นี่ (PetSleepSystem.wakeUpPet() จะเพิ่มให้ +4)
                    // PetSleepSystem จะจัดการการลด fatigue และเพิ่ม EXP
                    expGain = 0;
                    reactions.push(pickReaction('SLEEP_START'));
                    break;
            }

            // คำนวณอารมณ์และสุขภาพใหม่
            const newMood = this.calculateMood(stats);
            const health = this.calculateHealth(stats);

            // คำนวณ EXP และ Level
            let exp = Number(pet.exp || 0) + expGain;
            let level = Number(pet.level || 1);
            let nextexp = Number(pet.nextexp || Math.floor(level * level * 1.5));
            let leveledUp = false;

            // ตรวจสอบ level up
            while (exp >= nextexp) {
                const diff = exp - nextexp;
                level += 1;
                nextexp = Math.floor(level * level * 1.5);
                exp = diff;
                leveledUp = true;
                console.log(`[PET_BEHAVIOR] Pet ${petId} leveled up to ${level}!`);
            }

            // อัปเดตฐานข้อมูล (รวม EXP และ Level)
            await this.updatePetInDatabase(pet, stats, newMood, health, reactions, exp, level, nextexp);

            return {
                success: true,
                stats: stats,
                mood: newMood,
                health: health,
                reactions: reactions,
                exp: exp,
                level: level,
                nextexp: nextexp,
                expGain: expGain,
                leveledUp: leveledUp
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
