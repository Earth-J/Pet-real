const cron = require('node-cron');
const GPet = require("../settings/models/pet.js");
const { petBehaviorSystem } = require('./PetBehaviorSystem');
const { getEmotionKey, hasEmotionChanged, getEmotionDescription, getEmotionAdvice } = require('../structures/services/petEmotion');
const { getPoseKey, hasPoseChanged, getPoseDescription, getPoseAdvice } = require('../structures/services/petPose');
const { calculateHealth, getHealthStatus, getHealthDescription, getHealthAdvice, calculateStatInteractions, applyStatInteractions, needsUrgentCare, getCareRecommendations, STAT_RANGES } = require('../structures/services/petHealthSystem');

/**
 * ระบบวัฏจักรเกม (Game Loop) สำหรับสัตว์เลี้ยง
 * รวมทุกระบบเข้าด้วยกัน: ค่าหลัก, อารมณ์, ท่าทาง, อีโมต, สุขภาพ, และปฏิกิริยา
 */

class PetGameLoop {
    constructor() {
        this.isRunning = false;
        this.tickCount = 0;
        this.lastTick = Date.now();
        this.stats = {
            totalPets: 0,
            activePets: 0,
            urgentCarePets: 0,
            lastUpdate: null
        };
    }

    /**
     * เริ่มระบบวัฏจักรเกม
     */
    start() {
        if (this.isRunning) {
            console.log('[PET_GAME_LOOP] System already running');
            return;
        }

        console.log('[PET_GAME_LOOP] Starting pet game loop system...');
        
        // ปิดการใช้งาน PetBehaviorSystem เพื่อไม่ให้ซ้ำซ้อนกับ PetGameLoop
        // petBehaviorSystem.start(); // DISABLED: ใช้ PetGameLoop แทน
        
        // รันทุกๆ 1 นาที
        cron.schedule('* * * * *', async () => {
            try {
                await this.processGameTick();
            } catch (error) {
                console.error('[PET_GAME_LOOP] Error in game tick processing:', error);
            }
        });

        this.isRunning = true;
        console.log('[PET_GAME_LOOP] Pet game loop system started');
    }

    /**
     * ประมวลผลวัฏจักรเกมทุก tick (1 นาที)
     */
    async processGameTick() {
        try {
            this.tickCount++;
            const startTime = Date.now();
            
            console.log(`[PET_GAME_LOOP] Processing game tick #${this.tickCount}...`);

            // 1. ดึงข้อมูลสัตว์เลี้ยงทั้งหมด
            const pets = await GPet.find();
            this.stats.totalPets = pets.length;
            this.stats.activePets = 0;
            this.stats.urgentCarePets = 0;

            // 2. ประมวลผลแต่ละสัตว์เลี้ยง
            for (const pet of pets) {
                try {
                    await this.processPetTick(pet);
                    this.stats.activePets++;
                } catch (error) {
                    console.error(`[PET_GAME_LOOP] Error processing pet ${pet._id}:`, error);
                }
            }

            // 3. อัปเดตสถิติ
            this.stats.lastUpdate = new Date();
            this.lastTick = Date.now();

            const processingTime = Date.now() - startTime;
            console.log(`[PET_GAME_LOOP] Tick #${this.tickCount} completed in ${processingTime}ms`);
            console.log(`[PET_GAME_LOOP] Stats: ${this.stats.activePets}/${this.stats.totalPets} pets processed, ${this.stats.urgentCarePets} need urgent care`);

        } catch (error) {
            console.error('[PET_GAME_LOOP] Error processing game tick:', error);
        }
    }

    /**
     * ประมวลผลสัตว์เลี้ยงแต่ละตัวในแต่ละ tick
     */
    async processPetTick(pet) {
        try {
            // ข้ามสัตว์เลี้ยงที่กำลังนอนอยู่ (PetSleepSystem จะจัดการให้)
            if (pet.isSleeping) {
                console.log(`[PET_GAME_LOOP] Pet ${pet._id} is sleeping, skipping tick processing`);
                return;
            }

            // 1. คำนวณค่าหลักปัจจุบัน
            const currentStats = {
                fatigue: Number(pet.fatigue || 0),
                affection: Number(pet.affection || 0),
                fullness: Number(pet.fullness || 0),
                dirtiness: Number(pet.dirtiness || 0)
            };

            // 2. เพิ่ม/ลดค่าอัตโนมัติตามเวลา (ทุก 1 นาที)
            // ปิดการเพิ่มความล้าระหว่าง idle: ความล้าจะเปลี่ยนเฉพาะเมื่อมีกิจกรรม (เดิน/เล่น/ทำความสะอาด/กิน/นอน)
            // currentStats.fatigue ไม่เปลี่ยนแปลงใน tick พื้นฐาน
            
            // Fullness: หิวขึ้นเรื่อยๆ -0.25/นาที = -15/ชั่วโมง = ประมาณ 80 นาทีจะหิวเต็ม (ลดจาก -0.3)
            currentStats.fullness = Math.max(STAT_RANGES.MIN, currentStats.fullness - 0.25);
            
            // Affection: ลดลงถ้าไม่ได้ดูแลนานมาก (มากกว่า 1 ชั่วโมง)
            const lastActionTime = pet.lastPlayerActionTime ? new Date(pet.lastPlayerActionTime).getTime() : 0;
            const timeSinceLastAction = Date.now() - lastActionTime;
            if (timeSinceLastAction > 3600000) { // 1 ชั่วโมง
                currentStats.affection = Math.max(STAT_RANGES.MIN, currentStats.affection - 0.3); // ลดจาก -0.5
            }

            // 3. คำนวณความสัมพันธ์ระหว่างค่าสถานะ
            const interactions = calculateStatInteractions(pet);
            
            // 4. ประมวลผลผลกระทบของความสัมพันธ์
            // ปิดการเปลี่ยนแปลง fatigue จาก interaction ระหว่าง idle เพื่อให้ fatigue เปลี่ยนเฉพาะกิจกรรม
            const tempStats = applyStatInteractions(currentStats, interactions);
            const updatedStats = { ...tempStats, fatigue: currentStats.fatigue };

            // 5. คำนวณอารมณ์และท่าทางใหม่
            const newEmotion = getEmotionKey({ ...pet, ...updatedStats });
            const newPose = getPoseKey({ ...pet, ...updatedStats });

            // 6. คำนวณสุขภาพรวม
            const health = calculateHealth({ ...pet, ...updatedStats });
            const healthStatus = getHealthStatus(health);

            // 7. ตรวจสอบความต้องการการดูแลเร่งด่วน
            const needsUrgent = needsUrgentCare({ ...pet, ...updatedStats });
            if (needsUrgent) {
                this.stats.urgentCarePets++;
            }

            // 8. ตรวจสอบการเปลี่ยนแปลงที่สำคัญ
            const emotionChanged = hasEmotionChanged(pet.lastEmotion, newEmotion);
            const poseChanged = hasPoseChanged(pet.lastPose, newPose);
            const healthChanged = pet.lastHealth !== health;

            // 9. สร้างปฏิกิริยาใหม่ (ถ้ามีการเปลี่ยนแปลงสำคัญ)
            const reactions = [];
            if (emotionChanged) {
                reactions.push(`อารมณ์เปลี่ยนเป็น: ${getEmotionDescription(newEmotion)}`);
            }
            if (poseChanged) {
                reactions.push(`ท่าทางเปลี่ยนเป็น: ${getPoseDescription(newPose)}`);
            }
            if (healthChanged) {
                reactions.push(`สุขภาพเปลี่ยนเป็น: ${getHealthDescription(healthStatus)}`);
            }

            // 10. สร้างคำแนะนำการดูแล
            const careRecommendations = getCareRecommendations({ ...pet, ...updatedStats });

            // 11. อัปเดตฐานข้อมูล
            await this.updatePetInDatabase(pet, updatedStats, newEmotion, newPose, health, healthStatus, reactions, careRecommendations);

            // 12. แสดงข้อมูลการเปลี่ยนแปลง (ถ้ามี)
            if (emotionChanged || poseChanged || healthChanged || reactions.length > 0) {
                console.log(`[PET_GAME_LOOP] Pet ${pet._id} changes:`, {
                    emotion: `${pet.lastEmotion || 'unknown'} → ${newEmotion}`,
                    pose: `${pet.lastPose || 'unknown'} → ${newPose}`,
                    health: `${pet.lastHealth || 'unknown'} → ${health} (${healthStatus})`,
                    reactions: reactions.length
                });
            }

        } catch (error) {
            console.error(`[PET_GAME_LOOP] Error processing pet ${pet._id}:`, error);
        }
    }

    /**
     * อัปเดตข้อมูลสัตว์เลี้ยงในฐานข้อมูล
     */
    async updatePetInDatabase(pet, stats, emotion, pose, health, healthStatus, reactions, careRecommendations) {
        try {
            const updateData = {
                // ค่าหลัก
                fatigue: stats.fatigue,
                affection: stats.affection,
                fullness: stats.fullness,
                dirtiness: stats.dirtiness,
                
                // อารมณ์และท่าทาง
                lastEmotion: emotion,
                lastPose: pose,
                
                // สุขภาพ
                health: health,
                healthStatus: healthStatus,
                
                // ปฏิกิริยาและคำแนะนำ
                lastReactions: reactions,
                lastReactionTime: reactions.length > 0 ? new Date() : pet.lastReactionTime,
                careRecommendations: careRecommendations,
                
                // เวลา
                lastUpdate: new Date(),
                lastTick: this.tickCount
            };

            await GPet.updateOne(
                { _id: pet._id },
                { $set: updateData }
            );

        } catch (error) {
            console.error(`[PET_GAME_LOOP] Error updating pet ${pet._id} in database:`, error);
        }
    }

    /**
     * ประมวลผลการกระทำของผู้เล่น
     */
    async processPlayerAction(petId, action, params = {}) {
        try {
            const result = await petBehaviorSystem.processPlayerAction(petId, action, params);
            
            if (result.success) {
                // อัปเดตข้อมูลเพิ่มเติมหลังจากการกระทำ
                const pet = await GPet.findById(petId);
                if (pet) {
                    const health = calculateHealth(pet);
                    const healthStatus = getHealthStatus(health);
                    const careRecommendations = getCareRecommendations(pet);
                    
                    await GPet.updateOne(
                        { _id: petId },
                        { 
                            $set: { 
                                health: health,
                                healthStatus: healthStatus,
                                careRecommendations: careRecommendations,
                                lastPlayerAction: action,
                                lastPlayerActionTime: new Date()
                            }
                        }
                    );
                }
            }
            
            return result;
        } catch (error) {
            console.error(`[PET_GAME_LOOP] Error processing player action:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ได้รับสถิติระบบ
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            tickCount: this.tickCount,
            lastTick: this.lastTick,
            uptime: this.isRunning ? Date.now() - this.lastTick : 0
        };
    }

    /**
     * ได้รับข้อมูลสัตว์เลี้ยงพร้อมคำแนะนำ
     */
    async getPetStatus(petId) {
        try {
            const pet = await GPet.findById(petId);
            if (!pet) {
                throw new Error('Pet not found');
            }

            const emotion = getEmotionKey(pet);
            const pose = getPoseKey(pet);
            const health = calculateHealth(pet);
            const healthStatus = getHealthStatus(health);
            const careRecommendations = getCareRecommendations(pet);

            return {
                pet: {
                    id: pet._id,
                    name: pet.name,
                    type: pet.type,
                    level: pet.level
                },
                stats: {
                    fatigue: pet.fatigue,
                    affection: pet.affection,
                    fullness: pet.fullness,
                    dirtiness: pet.dirtiness
                },
                status: {
                    emotion: emotion,
                    pose: pose,
                    health: health,
                    healthStatus: healthStatus
                },
                descriptions: {
                    emotion: getEmotionDescription(emotion),
                    pose: getPoseDescription(pose),
                    health: getHealthDescription(healthStatus)
                },
                advice: {
                    emotion: getEmotionAdvice(emotion),
                    pose: getPoseAdvice(pose),
                    health: getHealthAdvice(healthStatus)
                },
                careRecommendations: careRecommendations,
                needsUrgentCare: needsUrgentCare(pet),
                lastUpdate: pet.lastUpdate
            };
        } catch (error) {
            console.error(`[PET_GAME_LOOP] Error getting pet status:`, error);
            return null;
        }
    }

    /**
     * หยุดระบบ
     */
    stop() {
        if (this.isRunning) {
            // petBehaviorSystem.stop(); // DISABLED: ไม่ได้ใช้งาน
            this.isRunning = false;
            console.log('[PET_GAME_LOOP] Pet game loop system stopped');
        }
    }
}

// สร้าง instance เดียว
const petGameLoop = new PetGameLoop();

module.exports = {
    PetGameLoop,
    petGameLoop
};


