const cron = require('node-cron');
const GPet = require("../settings/models/pet.js");
const { Client } = require('discord.js');

/**
 * ระบบการนอนสัตว์เลี้ยงที่สมจริง
 * - ต้องรอการนอนเสร็จก่อนทำกิจกรรมอื่น
 * - นอน 15-20 นาที
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
    start() {
        if (this.isRunning) {
            console.log('[PET_SLEEP] System already running');
            return;
        }

        console.log('[PET_SLEEP] Starting pet sleep system...');
        
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
            const pet = await GPet.findById(petId);
            if (!pet) {
                throw new Error('Pet not found');
            }

            // ตรวจสอบว่ากำลังนอนอยู่หรือไม่
            if (this.sleepingPets.has(petId)) {
                const sleepData = this.sleepingPets.get(petId);
                const remainingMinutes = sleepData.duration - Math.floor((Date.now() - sleepData.startTime) / (1000 * 60));
                return {
                    success: false,
                    message: `สัตว์เลี้ยงกำลังนอนอยู่ ต้องรออีก ${remainingMinutes} นาที`,
                    remainingMinutes
                };
            }

            // สุ่มเวลานอน 15-20 นาที
            const sleepDuration = durationMinutes || (15 + Math.floor(Math.random() * 6)); // 15-20 นาที

            // บันทึกข้อมูลการนอน
            const sleepData = {
                startTime: Date.now(),
                duration: sleepDuration,
                petId: petId,
                guild: pet.guild,
                user: pet.user
            };

            this.sleepingPets.set(petId, sleepData);

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

            console.log(`[PET_SLEEP] Pet ${petId} started sleeping for ${sleepDuration} minutes`);

            return {
                success: true,
                message: `สัตว์เลี้ยงเริ่มนอนแล้ว จะตื่นในอีก ${sleepDuration} นาที`,
                duration: sleepDuration,
                wakeUpTime: new Date(Date.now() + (sleepDuration * 60 * 1000))
            };

        } catch (error) {
            console.error(`[PET_SLEEP] Error starting sleep for pet ${petId}:`, error);
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
            const pet = await GPet.findById(petId);
            if (!pet) {
                this.sleepingPets.delete(petId);
                return;
            }

            // คำนวณการลด fatigue
            const fatigueReduction = Math.min(10, sleepTimeMinutes); // ลด fatigue ตามเวลานอน (สูงสุด 10)
            const newFatigue = Math.max(1, pet.fatigue - fatigueReduction);

            // อัปเดตข้อมูลสัตว์เลี้ยง
            await GPet.updateOne(
                { _id: petId },
                { 
                    $set: { 
                        isSleeping: false,
                        fatigue: newFatigue,
                        lastWakeTime: new Date()
                    },
                    $unset: {
                        sleepStartTime: 1,
                        sleepDuration: 1
                    }
                }
            );

            // ลบออกจากรายการสัตว์ที่กำลังนอน
            this.sleepingPets.delete(petId);

            console.log(`[PET_SLEEP] Pet ${petId} woke up after ${sleepTimeMinutes} minutes, fatigue reduced by ${fatigueReduction}`);

            // ส่งการแจ้งเตือนไปที่ DM
            await this.sendWakeUpNotification(pet, sleepTimeMinutes, fatigueReduction);

            return {
                success: true,
                message: `${pet.name} ตื่นแล้ว! พร้อมที่จะเล่นกับคุณแล้ว!`,
                fatigueReduction: fatigueReduction,
                newFatigue: newFatigue
            };

        } catch (error) {
            console.error(`[PET_SLEEP] Error waking up pet ${petId}:`, error);
            this.sleepingPets.delete(petId);
        }
    }

    /**
     * ตรวจสอบว่าสัตว์กำลังนอนหรือไม่
     */
    isPetSleeping(petId) {
        return this.sleepingPets.has(petId);
    }

    /**
     * ตรวจสอบเวลาที่เหลือในการนอน
     */
    getRemainingSleepTime(petId) {
        const sleepData = this.sleepingPets.get(petId);
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
        const sleepData = this.sleepingPets.get(petId);
        if (!sleepData) {
            return {
                success: false,
                message: 'สัตว์เลี้ยงไม่ได้นอนอยู่'
            };
        }

        await this.wakeUpPet(petId, sleepData, 0);
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
    async sendWakeUpNotification(pet, sleepTimeMinutes, fatigueReduction) {
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
                .setTitle(`😊 ${pet.name} ตื่นแล้ว!`)
                .setDescription(`สัตว์เลี้ยงของคุณตื่นจากการนอนแล้ว พร้อมที่จะเล่นกับคุณ!`)
                .setColor('#00ff00')
                .setThumbnail(guild.iconURL() || null)
                .setTimestamp()
                .addFields(
                    {
                        name: "😴 ข้อมูลการนอน",
                        value: `**เวลานอน:** ${sleepTimeMinutes} นาที\n**ความล้าลดลง:** ${fatigueReduction} หน่วย`,
                        inline: true
                    },
                    {
                        name: "💖 สถานะปัจจุบัน",
                        value: `**ความล้า:** ${pet.fatigue}/20\n**ความเอ็นดู:** ${pet.affection}/20\n**ความอิ่ม:** ${pet.fullness}/20\n**ความสกปรก:** ${pet.dirtiness}/20`,
                        inline: true
                    },
                    {
                        name: "✅ กิจกรรมที่ทำได้",
                        value: `• ให้อาหาร\n• ทำความสะอาด\n• เล่นด้วย\n• พาเดินเล่น`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `จากเซิร์ฟเวอร์: ${guild.name}` 
                });

            // ส่ง DM
            await user.send({ 
                content: `🎉 **${pet.name} ตื่นแล้ว!** พร้อมที่จะเล่นกับคุณแล้ว! 💤→😊`,
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
                                    content: `🎉 <@${user.id}> **${pet.name} ตื่นแล้ว!** พร้อมที่จะเล่นกับคุณแล้ว! 💤→😊` 
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
