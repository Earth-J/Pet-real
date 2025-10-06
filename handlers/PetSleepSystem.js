const cron = require('node-cron');
const GPet = require("../settings/models/pet.js");
const { Client } = require('discord.js');

/**
 * ระบบการนอนสัตว์เลี้ยงที่สมจริง
 * - ต้องรอการนอนเสร็จก่อนทำกิจกรรมอื่น
 * - นอน 5-10 นาที
 * - ระหว่างนอน fatigue ไม่เพิ่ม
 * - แจ้งเตือนเมื่อตื่น
 */

class PetSleepSystem {
    constructor() {
        this.sleepingPets = new Map(); // เก็บข้อมูลสัตว์ที่กำลังนอน
        this.isRunning = false;
        this.client = null; // เก็บ Discord client สำหรับส่ง DM
    }

    /**
     * ตั้งค่า Discord client
     */
    setClient(client) {
        this.client = client;
    }

    /**
     * เริ่มระบบการนอน
     */
    async start() {
        if (this.isRunning) {
            console.log('[PET_SLEEP] System already running');
            return;
        }

        console.log('[PET_SLEEP] Starting pet sleep system...');
        
        // กู้คืนสถานะการนอนจากฐานข้อมูล (กรณีบอทดับ)
        await this.recoverSleepingPets();
        
        // ตรวจสอบสัตว์ที่กำลังนอนทุกๆ 1 นาที
        cron.schedule('* * * * *', async () => {
            try {
                await this.checkSleepingPets();
            } catch (error) {
                console.error('[PET_SLEEP] Error checking sleeping pets:', error);
            }
        });

        this.isRunning = true;
        console.log('[PET_SLEEP] Pet sleep system started');
    }

    /**
     * กู้คืนสถานะการนอนจากฐานข้อมูล (เมื่อบอทเปิดใหม่)
     */
    async recoverSleepingPets() {
        try {
            console.log('[PET_SLEEP] Recovering sleeping pets from database...');
            
            // หาสัตว์ที่ยังติดสถานะนอนอยู่
            const sleepingPets = await GPet.find({ 
                isSleeping: true,
                sleepStartTime: { $exists: true },
                sleepDuration: { $exists: true }
            });

            console.log(`[PET_SLEEP] Found ${sleepingPets.length} pets in sleeping state`);

            for (const pet of sleepingPets) {
                const now = Date.now();
                const startTime = new Date(pet.sleepStartTime).getTime();
                const duration = Number(pet.sleepDuration || 15);
                const elapsedMinutes = Math.floor((now - startTime) / (1000 * 60));

                // ถ้าครบเวลานอนแล้ว ให้ปลุกเลย
                if (elapsedMinutes >= duration) {
                    console.log(`[PET_SLEEP] Pet ${pet._id} sleep time expired (${elapsedMinutes}/${duration} min), waking up...`);
                    const sleepData = {
                        startTime: startTime,
                        duration: duration,
                        petId: pet._id,
                        guild: pet.guild,
                        user: pet.user
                    };
                    await this.wakeUpPet(pet._id, sleepData, elapsedMinutes);
                } else {
                    // ยังไม่ครบเวลา ให้เพิ่มกลับเข้า Map
                    const remainingMinutes = duration - elapsedMinutes;
                    console.log(`[PET_SLEEP] Pet ${pet._id} still sleeping (${elapsedMinutes}/${duration} min, ${remainingMinutes} min remaining)`);
                    
                    const sleepData = {
                        startTime: startTime,
                        duration: duration,
                        petId: pet._id,
                        guild: pet.guild,
                        user: pet.user
                    };
                    
                    this.sleepingPets.set(pet._id.toString(), sleepData);
                }
            }

            console.log(`[PET_SLEEP] Recovery complete. Currently tracking ${this.sleepingPets.size} sleeping pets`);
            
        } catch (error) {
            console.error('[PET_SLEEP] Error recovering sleeping pets:', error);
        }
    }

    /**
     * ตรวจสอบสัตว์ที่กำลังนอน
     */
    async checkSleepingPets() {
        try {
            const now = Date.now();
            const petsToWake = [];

            // ตรวจสอบสัตว์ที่ควรตื่นแล้ว
            for (const [petId, sleepData] of this.sleepingPets.entries()) {
                const sleepDuration = now - sleepData.startTime;
                const sleepTimeMinutes = Math.floor(sleepDuration / (1000 * 60));

                if (sleepTimeMinutes >= sleepData.duration) {
                    petsToWake.push({ petId, sleepData, sleepTimeMinutes });
                }
            }

            // ตื่นสัตว์ที่ครบเวลาแล้ว
            for (const { petId, sleepData, sleepTimeMinutes } of petsToWake) {
                await this.wakeUpPet(petId, sleepData, sleepTimeMinutes);
            }

        } catch (error) {
            console.error('[PET_SLEEP] Error in checkSleepingPets:', error);
        }
    }

    /**
     * เริ่มการนอน
     */
    async startSleep(petId, durationMinutes = null) {
        try {
            // แปลง petId เป็น string เพื่อความ consistent
            const petIdStr = String(petId);
            
            const pet = await GPet.findById(petId);
            if (!pet) {
                throw new Error('Pet not found');
            }

            // ตรวจสอบว่ากำลังนอนอยู่หรือไม่
            if (this.sleepingPets.has(petIdStr)) {
                const sleepData = this.sleepingPets.get(petIdStr);
                const remainingMinutes = sleepData.duration - Math.floor((Date.now() - sleepData.startTime) / (1000 * 60));
                return {
                    success: false,
                    message: `สัตว์เลี้ยงกำลังนอนอยู่ ต้องรออีก ${remainingMinutes} นาที`,
                    remainingMinutes
                };
            }

            // สุ่มเวลานอน 10-15 นาที
            const sleepDuration = durationMinutes || (10 + Math.floor(Math.random() * 6)); // 10-15 นาที

            // บันทึกข้อมูลการนอน
            const sleepData = {
                startTime: Date.now(),
                duration: sleepDuration,
                petId: petIdStr,
                guild: pet.guild,
                user: pet.user
            };

            this.sleepingPets.set(petIdStr, sleepData);

            // อัปเดตสถานะในฐานข้อมูล
            await GPet.updateOne(
                { _id: petId },
                { 
                    $set: { 
                        isSleeping: true,
                        sleepStartTime: new Date(),
                        sleepDuration: sleepDuration,
                        lastSleepTime: new Date()
                    }
                }
            );

            console.log(`[PET_SLEEP] Pet ${petIdStr} started sleeping for ${sleepDuration} minutes`);

            return {
                success: true,
                message: `สัตว์เลี้ยงเริ่มนอนแล้ว จะตื่นในอีก ${sleepDuration} นาที`,
                duration: sleepDuration,
                wakeUpTime: new Date(Date.now() + (sleepDuration * 60 * 1000))
            };

        } catch (error) {
            console.error(`[PET_SLEEP] Error starting sleep for pet ${String(petId)}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ตื่นสัตว์เลี้ยง
     */
    async wakeUpPet(petId, sleepData, sleepTimeMinutes) {
        try {
            const petIdStr = String(petId);
            const pet = await GPet.findById(petId);
            if (!pet) {
                this.sleepingPets.delete(petIdStr);
                return;
            }

            // ตั้งความล้าให้เป็น 0 หลังนอนเสร็จตามที่กำหนด
            const fatigueReduction = pet.fatigue; // เพื่อนำไปแสดงผล
            const newFatigue = 0;

            // เพิ่ม EXP จากการนอน: สเกลตามเวลานอนจริงและระดับความล้าก่อนนอน
            const { petBehaviorSystem } = require("./PetBehaviorSystem");
            const fatigueBefore = Number(pet.fatigue || 0);
            // ฐาน EXP ต่อ 5 นาที = 10, ต่อ 15 นาที = 30 (เชิงเส้น)
            const basePerMinute = 2; // 10 EXP ต่อ 5 นาที -> 2 ต่อ 1 นาที
            const timeExp = Math.round(basePerMinute * Math.max(1, sleepTimeMinutes));
            // โบนัสจากความล้าที่มากขึ้น (0..+50%)
            const fatigueBonusMultiplier = 1 + Math.min(0.5, fatigueBefore / 40); // fatigue 20 → +50%
            const expGain = Math.max(1, Math.floor(timeExp * fatigueBonusMultiplier));
            let exp = Number(pet.exp || 0) + expGain;
            let level = Number(pet.level || 1);
            let nextexp = Number(pet.nextexp || petBehaviorSystem.computeNextExp(level));
            let leveledUp = false;

            // ตรวจสอบ level up
            while (exp >= nextexp) {
                const diff = exp - nextexp;
                level += 1;
                nextexp = petBehaviorSystem.computeNextExp(level);
                exp = diff;
                leveledUp = true;
                console.log(`[PET_SLEEP] Pet ${petId} leveled up to ${level} after waking up!`);
            }

            // อัปเดตข้อมูลสัตว์เลี้ยง (รวม EXP และ Level)
            await GPet.updateOne(
                { _id: petId },
                { 
                    $set: { 
                        isSleeping: false,
                        fatigue: newFatigue,
                        exp: exp,
                        level: level,
                        nextexp: nextexp,
                        lastWakeTime: new Date()
                    },
                    $unset: {
                        sleepStartTime: 1,
                        sleepDuration: 1
                    }
                }
            );

            // อัปเดตค่าในออบเจกต์ที่ใช้ส่งแจ้งเตือนให้สะท้อนค่าล่าสุด
            pet.fatigue = newFatigue;
            pet.exp = exp;
            pet.level = level;
            pet.nextexp = nextexp;

            // ลบออกจากรายการสัตว์ที่กำลังนอน
            this.sleepingPets.delete(petIdStr);

            console.log(`[PET_SLEEP] Pet ${petIdStr} woke up after ${sleepTimeMinutes} minutes, fatigue reduced by ${fatigueReduction}, gained ${expGain} EXP${leveledUp ? ', LEVELED UP!' : ''}`);

            // ส่งการแจ้งเตือนไปที่ DM
            await this.sendWakeUpNotification(pet, sleepTimeMinutes, fatigueReduction, expGain, leveledUp, level);

            return {
                success: true,
                message: `${pet.name} ตื่นแล้ว! พร้อมที่จะเล่นกับคุณแล้ว!`,
                fatigueReduction: fatigueReduction,
                newFatigue: newFatigue,
                expGain: expGain,
                leveledUp: leveledUp,
                level: level
            };

        } catch (error) {
            console.error(`[PET_SLEEP] Error waking up pet ${String(petId)}:`, error);
            this.sleepingPets.delete(String(petId));
        }
    }

    /**
     * ตรวจสอบว่าสัตว์กำลังนอนหรือไม่
     */
    isPetSleeping(petId) {
        return this.sleepingPets.has(String(petId));
    }

    /**
     * ตรวจสอบเวลาที่เหลือในการนอน
     */
    getRemainingSleepTime(petId) {
        const sleepData = this.sleepingPets.get(String(petId));
        if (!sleepData) return null;

        const now = Date.now();
        const elapsed = now - sleepData.startTime;
        const remaining = sleepData.duration * 60 * 1000 - elapsed;
        
        return Math.max(0, Math.ceil(remaining / (1000 * 60))); // คืนเป็นนาที
    }

    /**
     * บังคับตื่น (สำหรับ admin)
     */
    async forceWakeUp(petId) {
        const petIdStr = String(petId);
        const sleepData = this.sleepingPets.get(petIdStr);
        if (!sleepData) {
            return {
                success: false,
                message: 'สัตว์เลี้ยงไม่ได้นอนอยู่'
            };
        }

        await this.wakeUpPet(petIdStr, sleepData, 0);
        return {
            success: true,
            message: 'บังคับตื่นสัตว์เลี้ยงสำเร็จ'
        };
    }

    /**
     * ได้รับสถิติการนอน
     */
    getSleepStats() {
        return {
            sleepingCount: this.sleepingPets.size,
            sleepingPets: Array.from(this.sleepingPets.entries()).map(([petId, data]) => ({
                petId,
                remainingMinutes: this.getRemainingSleepTime(petId),
                startTime: data.startTime,
                duration: data.duration
            }))
        };
    }

    /**
     * ส่งแจ้งเตือนการตื่นไปที่ DM
     */
    async sendWakeUpNotification(pet, sleepTimeMinutes, fatigueReduction, expGain = 0, leveledUp = false, newLevel = null) {
        try {
            if (!this.client) {
                console.log('[PET_SLEEP] No Discord client available for DM notification');
                return;
            }

            // หา guild และ user
            const guild = this.client.guilds.cache.get(pet.guild);
            if (!guild) {
                console.log(`[PET_SLEEP] Guild ${pet.guild} not found`);
                return;
            }

            const user = await this.client.users.fetch(pet.user);
            if (!user) {
                console.log(`[PET_SLEEP] User ${pet.user} not found`);
                return;
            }

            // สร้าง embed สำหรับแจ้งเตือน
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setTitle(`😊 ${pet.name} ตื่นแล้ว!${leveledUp ? ' 🎉' : ''}`)
                .setDescription(`สัตว์เลี้ยงของคุณตื่นจากการนอนแล้ว พร้อมที่จะเล่นกับคุณ!${leveledUp ? `\n✨ **เลเวลอัปเป็นเลเวล ${newLevel}!**` : ''}`)
                .setColor(leveledUp ? '#c9ce93' : '#c9ce93')
                .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/time.png")
                .setFooter({ 
                    text: `จากเซิร์ฟเวอร์: ${guild.name}` 
                });

            // ส่ง DM
            await user.send({ 
                content: `🎉 **${pet.name} ตื่นแล้ว!** พร้อมที่จะเล่นกับคุณแล้ว! | ${leveledUp ? ` เลเวลอัป! 🎊` : ''}`,
                embeds: [embed] 
            });

            console.log(`[PET_SLEEP] Wake up notification sent to user ${user.username} (${user.id})`);

        } catch (error) {
            console.error('[PET_SLEEP] Error sending wake up notification:', error);
            
            // ถ้าส่ง DM ไม่ได้ ให้ลองส่งใน guild แทน
            try {
                if (this.client) {
                    const guild = this.client.guilds.cache.get(pet.guild);
                    if (guild) {
                        const user = await this.client.users.fetch(pet.user);
                        if (user) {
                            // หา channel ที่ user สามารถเห็นได้
                            const channel = guild.channels.cache.find(ch => 
                                ch.type === 0 && ch.permissionsFor(user).has('ViewChannel')
                            );
                            
                            if (channel) {
                                await channel.send({ 
                                    content: `🎉 <@${user.id}> **${pet.name} ตื่นแล้ว!** พร้อมที่จะเล่นกับคุณแล้ว! | ${leveledUp ? ` เลเวลอัป! 🎊` : ''}` 
                                });
                                console.log(`[PET_SLEEP] Wake up notification sent to channel ${channel.name} as fallback`);
                            }
                        }
                    }
                }
            } catch (fallbackError) {
                console.error('[PET_SLEEP] Error sending fallback notification:', fallbackError);
            }
        }
    }

    /**
     * หยุดระบบ
     */
    stop() {
        if (this.isRunning) {
            this.sleepingPets.clear();
            this.isRunning = false;
            console.log('[PET_SLEEP] Pet sleep system stopped');
        }
    }
}

// สร้าง instance เดียว
const petSleepSystem = new PetSleepSystem();

module.exports = {
    PetSleepSystem,
    petSleepSystem
};
