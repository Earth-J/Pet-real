const mongoose = require('mongoose');
const GPet = require('../settings/models/pet.js');

/**
 * สคริปต์ Migration สำหรับแปลงข้อมูลสัตว์เลี้ยงเก่าเป็นระบบใหม่
 * แก้ไขปัญหาผู้เล่นเก่าที่สัตว์เลี้ยงไม่แสดงเพราะขาดฟิลด์ใหม่
 */

class PetDataMigrator {
    constructor() {
        this.migrationStats = {
            total: 0,
            migrated: 0,
            errors: 0,
            skipped: 0
        };
    }

    /**
     * แปลงข้อมูลสัตว์เลี้ยงเก่าเป็นระบบใหม่
     */
    convertPetData(oldPet) {
        const newPet = { ...oldPet };

        // ตรวจสอบว่ามีฟิลด์ใหม่แล้วหรือไม่
        const hasNewFields = (
            typeof newPet.affection !== 'undefined' &&
            typeof newPet.fullness !== 'undefined' &&
            typeof newPet.dirtiness !== 'undefined' &&
            typeof newPet.fatigue !== 'undefined'
        );

        if (hasNewFields) {
            console.log(`⏭️  Pet ${oldPet._id} already has new fields, skipping`);
            return null; // ข้ามการแปลง
        }

        // แปลงจากระบบเก่าเป็นระบบใหม่
        // ระบบเก่า: health, hungry, sleep, cleanliness (ค่าสูง = ดี)
        // ระบบใหม่: affection, fullness, dirtiness, fatigue

        // affection = health (ค่าสูง = ดี)
        if (typeof newPet.health !== 'undefined') {
            newPet.affection = Math.max(0, Math.min(20, Number(newPet.health) || 20));
        } else {
            newPet.affection = 20; // ค่าเริ่มต้น
        }

        // fullness = hungry (ค่าสูง = อิ่ม)
        if (typeof newPet.hungry !== 'undefined') {
            newPet.fullness = Math.max(0, Math.min(20, Number(newPet.hungry) || 20));
        } else {
            newPet.fullness = 20; // ค่าเริ่มต้น
        }

        // dirtiness = 20 - cleanliness (ค่าสูง = สกปรก)
        if (typeof newPet.cleanliness !== 'undefined') {
            newPet.dirtiness = Math.max(0, Math.min(20, 20 - (Number(newPet.cleanliness) || 20)));
        } else {
            newPet.dirtiness = 0; // ค่าเริ่มต้น (สะอาด)
        }

        // fatigue = 20 - sleep (ค่าสูง = เหนื่อย)
        if (typeof newPet.sleep !== 'undefined') {
            newPet.fatigue = Math.max(0, Math.min(20, 20 - (Number(newPet.sleep) || 20)));
        } else {
            newPet.fatigue = 0; // ค่าเริ่มต้น (ไม่เหนื่อย)
        }

        // เพิ่มฟิลด์ใหม่ที่อาจขาดหายไป
        if (typeof newPet.fireStreak === 'undefined') {
            newPet.fireStreak = 0;
        }
        if (typeof newPet.lastActivityDate === 'undefined') {
            newPet.lastActivityDate = '';
        }
        if (typeof newPet.mood === 'undefined') {
            newPet.mood = 'content';
        }
        if (typeof newPet.lastEmotion === 'undefined') {
            newPet.lastEmotion = 'happy';
        }
        if (typeof newPet.lastPose === 'undefined') {
            newPet.lastPose = 'idle';
        }
        if (typeof newPet.healthStatus === 'undefined') {
            newPet.healthStatus = 'excellent';
        }
        if (typeof newPet.lastReactions === 'undefined') {
            newPet.lastReactions = [];
        }
        if (typeof newPet.lastReactionTime === 'undefined') {
            newPet.lastReactionTime = null;
        }
        if (typeof newPet.careRecommendations === 'undefined') {
            newPet.careRecommendations = [];
        }
        if (typeof newPet.lastPlayerAction === 'undefined') {
            newPet.lastPlayerAction = '';
        }
        if (typeof newPet.lastPlayerActionTime === 'undefined') {
            newPet.lastPlayerActionTime = null;
        }
        if (typeof newPet.lastUpdate === 'undefined') {
            newPet.lastUpdate = new Date();
        }
        if (typeof newPet.lastTick === 'undefined') {
            newPet.lastTick = 0;
        }
        if (typeof newPet.isSleeping === 'undefined') {
            newPet.isSleeping = false;
        }
        if (typeof newPet.sleepStartTime === 'undefined') {
            newPet.sleepStartTime = null;
        }
        if (typeof newPet.sleepDuration === 'undefined') {
            newPet.sleepDuration = 0;
        }
        if (typeof newPet.lastSleepTime === 'undefined') {
            newPet.lastSleepTime = null;
        }
        if (typeof newPet.lastWakeTime === 'undefined') {
            newPet.lastWakeTime = null;
        }

        // คำนวณสุขภาพใหม่จากระบบใหม่
        const health = this.calculateNewHealth(newPet);
        newPet.health = health;

        return newPet;
    }

    /**
     * คำนวณสุขภาพใหม่จากระบบใหม่
     */
    calculateNewHealth(pet) {
        const affection = Number(pet.affection ?? 0);
        const fullness = Number(pet.fullness ?? 0);
        const dirtiness = Number(pet.dirtiness ?? 0);
        const fatigue = Number(pet.fatigue ?? 0);

        // คำนวณคะแนนสุขภาพสำหรับแต่ละค่า (0-1)
        const affectionScore = affection / 20;
        const fullnessScore = fullness / 20;
        const cleanlinessScore = (20 - dirtiness) / 20;
        const energyScore = (20 - fatigue) / 20;

        // คำนวณสุขภาพรวม (เฉลี่ยของทุกค่า)
        const healthScore = (affectionScore + fullnessScore + cleanlinessScore + energyScore) / 4;
        
        // แปลงเป็นค่า 1-20
        return Math.round(healthScore * 20);
    }

    /**
     * รันการ migration
     */
    async migratePets() {
        console.log('🐾 Starting Pet Data Migration...');
        console.log('Converting old pet data (health, hungry, sleep, cleanliness) to new system (affection, fullness, dirtiness, fatigue)');
        
        try {
            // ดึงข้อมูลสัตว์เลี้ยงทั้งหมด
            const pets = await GPet.find({});
            this.migrationStats.total = pets.length;
            
            console.log(`📊 Found ${pets.length} pets to process`);

            for (const pet of pets) {
                try {
                    const convertedPet = this.convertPetData(pet);
                    
                    if (convertedPet === null) {
                        this.migrationStats.skipped++;
                        continue; // ข้ามการแปลง
                    }

                    // อัปเดตข้อมูลในฐานข้อมูล
                    await GPet.findByIdAndUpdate(pet._id, convertedPet, { new: true });
                    
                    this.migrationStats.migrated++;
                    console.log(`✅ Migrated pet ${pet._id} for user ${pet.user} in guild ${pet.guild}`);
                    console.log(`   Old: health=${pet.health}, hungry=${pet.hungry}, sleep=${pet.sleep}, cleanliness=${pet.cleanliness}`);
                    console.log(`   New: affection=${convertedPet.affection}, fullness=${convertedPet.fullness}, dirtiness=${convertedPet.dirtiness}, fatigue=${convertedPet.fatigue}, health=${convertedPet.health}`);
                    
                } catch (error) {
                    this.migrationStats.errors++;
                    console.error(`❌ Error migrating pet ${pet._id}:`, error.message);
                }
            }
            
            console.log('\n📈 Migration Summary:');
            console.log(`Total pets: ${this.migrationStats.total}`);
            console.log(`Migrated: ${this.migrationStats.migrated}`);
            console.log(`Skipped: ${this.migrationStats.skipped}`);
            console.log(`Errors: ${this.migrationStats.errors}`);
            
        } catch (error) {
            console.error('❌ Pet migration failed:', error);
        }
    }

    /**
     * ตรวจสอบผลลัพธ์การ migration
     */
    async validateMigration() {
        console.log('\n🔍 Validating migration...');
        
        try {
            const totalPets = await GPet.countDocuments();
            const petsWithNewFields = await GPet.countDocuments({
                affection: { $exists: true },
                fullness: { $exists: true },
                dirtiness: { $exists: true },
                fatigue: { $exists: true }
            });
            
            console.log(`Total pets: ${totalPets}`);
            console.log(`Pets with new fields: ${petsWithNewFields}`);
            
            if (petsWithNewFields === totalPets) {
                console.log('✅ All pets have been migrated successfully!');
                return true;
            } else {
                console.log(`❌ ${totalPets - petsWithNewFields} pets still need migration`);
                return false;
            }
            
        } catch (error) {
            console.error('❌ Validation error:', error);
            return false;
        }
    }

    /**
     * แสดงตัวอย่างข้อมูลสัตว์เลี้ยงที่แปลงแล้ว
     */
    async showSampleData() {
        console.log('\n📋 Sample migrated pet data:');
        
        try {
            const samplePets = await GPet.find({
                affection: { $exists: true },
                fullness: { $exists: true },
                dirtiness: { $exists: true },
                fatigue: { $exists: true }
            }).limit(3);
            
            for (const pet of samplePets) {
                console.log(`\nPet ${pet._id}:`);
                console.log(`  User: ${pet.user}, Guild: ${pet.guild}`);
                console.log(`  Name: ${pet.name}, Type: ${pet.type}`);
                console.log(`  Affection: ${pet.affection}, Fullness: ${pet.fullness}`);
                console.log(`  Dirtiness: ${pet.dirtiness}, Fatigue: ${pet.fatigue}`);
                console.log(`  Health: ${pet.health}, Level: ${pet.level}`);
            }
            
        } catch (error) {
            console.error('❌ Error showing sample data:', error);
        }
    }
}

// สำหรับการรัน script
async function main() {
    try {
        // เชื่อมต่อ MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
        console.log('✅ Connected to MongoDB');
        
        const migrator = new PetDataMigrator();
        await migrator.migratePets();
        await migrator.validateMigration();
        await migrator.showSampleData();
        
        console.log('\n📝 Migration completed!');
        console.log('Next steps:');
        console.log('1. Test pet display functionality');
        console.log('2. Monitor for any issues');
        console.log('3. Consider removing old fields after confirming everything works');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// เรียกใช้ script หากรันโดยตรง
if (require.main === module) {
    main();
}

module.exports = { PetDataMigrator };

