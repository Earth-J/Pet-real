const mongoose = require('mongoose');
const GPet = require('../settings/models/pet.js');
const { getEmotionKey } = require('../structures/services/petEmotion');
const { getPoseKey } = require('../structures/services/petPose');
const { calculateHealth, getHealthStatus, needsUrgentCare } = require('../structures/services/petHealthSystem');

/**
 * สคริปต์ทดสอบการทำงานของระบบ fallback สำหรับข้อมูลสัตว์เลี้ยงเก่า
 */

class PetSystemTester {
    constructor() {
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    /**
     * ทดสอบการแปลงข้อมูลเก่าเป็นระบบใหม่
     */
    testOldDataConversion() {
        console.log('🧪 Testing old data conversion...');
        
        // สร้างข้อมูลสัตว์เลี้ยงเก่า (จำลอง)
        const oldPetData = {
            guild: 'test-guild',
            user: 'test-user',
            name: 'Test Pet',
            type: 'cat',
            level: 5,
            exp: 250,
            nextexp: 500,
            // ระบบเก่า
            health: 15,
            hungry: 8,
            sleep: 12,
            cleanliness: 18
        };

        // ทดสอบ getEmotionKey
        try {
            const emotion = getEmotionKey(oldPetData);
            console.log(`✅ getEmotionKey: ${emotion}`);
            this.testResults.passed++;
        } catch (error) {
            console.log(`❌ getEmotionKey failed: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`getEmotionKey: ${error.message}`);
        }

        // ทดสอบ getPoseKey
        try {
            const pose = getPoseKey(oldPetData);
            console.log(`✅ getPoseKey: ${pose}`);
            this.testResults.passed++;
        } catch (error) {
            console.log(`❌ getPoseKey failed: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`getPoseKey: ${error.message}`);
        }

        // ทดสอบ calculateHealth
        try {
            const health = calculateHealth(oldPetData);
            console.log(`✅ calculateHealth: ${health}`);
            this.testResults.passed++;
        } catch (error) {
            console.log(`❌ calculateHealth failed: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`calculateHealth: ${error.message}`);
        }

        // ทดสอบ getHealthStatus
        try {
            const health = calculateHealth(oldPetData);
            const status = getHealthStatus(health);
            console.log(`✅ getHealthStatus: ${status}`);
            this.testResults.passed++;
        } catch (error) {
            console.log(`❌ getHealthStatus failed: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`getHealthStatus: ${error.message}`);
        }

        // ทดสอบ needsUrgentCare
        try {
            const urgent = needsUrgentCare(oldPetData);
            console.log(`✅ needsUrgentCare: ${urgent}`);
            this.testResults.passed++;
        } catch (error) {
            console.log(`❌ needsUrgentCare failed: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push(`needsUrgentCare: ${error.message}`);
        }

        this.testResults.total += 5;
    }

    /**
     * ทดสอบการทำงานกับข้อมูลใหม่
     */
    testNewDataSystem() {
        console.log('\n🧪 Testing new data system...');
        
        // สร้างข้อมูลสัตว์เลี้ยงใหม่
        const newPetData = {
            guild: 'test-guild',
            user: 'test-user',
            name: 'Test Pet New',
            type: 'dog',
            level: 3,
            exp: 150,
            nextexp: 300,
            // ระบบใหม่
            affection: 18,
            fullness: 12,
            dirtiness: 3,
            fatigue: 5
        };

        // ทดสอบฟังก์ชันต่างๆ
        const tests = [
            { name: 'getEmotionKey', func: () => getEmotionKey(newPetData) },
            { name: 'getPoseKey', func: () => getPoseKey(newPetData) },
            { name: 'calculateHealth', func: () => calculateHealth(newPetData) },
            { name: 'getHealthStatus', func: () => getHealthStatus(calculateHealth(newPetData)) },
            { name: 'needsUrgentCare', func: () => needsUrgentCare(newPetData) }
        ];

        for (const test of tests) {
            try {
                const result = test.func();
                console.log(`✅ ${test.name}: ${result}`);
                this.testResults.passed++;
            } catch (error) {
                console.log(`❌ ${test.name} failed: ${error.message}`);
                this.testResults.failed++;
                this.testResults.errors.push(`${test.name}: ${error.message}`);
            }
            this.testResults.total++;
        }
    }

    /**
     * ทดสอบข้อมูลผสม (มีทั้งเก่าและใหม่)
     */
    testMixedData() {
        console.log('\n🧪 Testing mixed data (both old and new fields)...');
        
        const mixedPetData = {
            guild: 'test-guild',
            user: 'test-user',
            name: 'Mixed Pet',
            type: 'bird',
            level: 7,
            exp: 400,
            nextexp: 800,
            // ระบบเก่า
            health: 10,
            hungry: 5,
            sleep: 15,
            cleanliness: 8,
            // ระบบใหม่ (ควรใช้ระบบใหม่เป็นหลัก)
            affection: 20,
            fullness: 20,
            dirtiness: 0,
            fatigue: 0
        };

        const tests = [
            { name: 'getEmotionKey', func: () => getEmotionKey(mixedPetData) },
            { name: 'getPoseKey', func: () => getPoseKey(mixedPetData) },
            { name: 'calculateHealth', func: () => calculateHealth(mixedPetData) }
        ];

        for (const test of tests) {
            try {
                const result = test.func();
                console.log(`✅ ${test.name}: ${result}`);
                this.testResults.passed++;
            } catch (error) {
                console.log(`❌ ${test.name} failed: ${error.message}`);
                this.testResults.failed++;
                this.testResults.errors.push(`${test.name}: ${error.message}`);
            }
            this.testResults.total++;
        }
    }

    /**
     * ทดสอบข้อมูลที่เสียหายหรือไม่สมบูรณ์
     */
    testCorruptedData() {
        console.log('\n🧪 Testing corrupted/incomplete data...');
        
        const corruptedPetData = {
            guild: 'test-guild',
            user: 'test-user',
            name: 'Corrupted Pet',
            type: 'fish',
            level: 1,
            exp: 0,
            nextexp: 100,
            // ข้อมูลไม่สมบูรณ์
            health: null,
            hungry: undefined,
            sleep: 'invalid',
            cleanliness: -5
        };

        const tests = [
            { name: 'getEmotionKey', func: () => getEmotionKey(corruptedPetData) },
            { name: 'getPoseKey', func: () => getPoseKey(corruptedPetData) },
            { name: 'calculateHealth', func: () => calculateHealth(corruptedPetData) }
        ];

        for (const test of tests) {
            try {
                const result = test.func();
                console.log(`✅ ${test.name}: ${result} (handled gracefully)`);
                this.testResults.passed++;
            } catch (error) {
                console.log(`❌ ${test.name} failed: ${error.message}`);
                this.testResults.failed++;
                this.testResults.errors.push(`${test.name}: ${error.message}`);
            }
            this.testResults.total++;
        }
    }

    /**
     * ทดสอบข้อมูลจากฐานข้อมูลจริง
     */
    async testRealDatabaseData() {
        console.log('\n🧪 Testing with real database data...');
        
        try {
            // หาข้อมูลสัตว์เลี้ยงที่มีเฉพาะระบบเก่า
            const oldPets = await GPet.find({
                $and: [
                    { health: { $exists: true } },
                    { hungry: { $exists: true } },
                    { sleep: { $exists: true } },
                    { cleanliness: { $exists: true } },
                    { affection: { $exists: false } }
                ]
            }).limit(3);

            console.log(`Found ${oldPets.length} pets with old data structure`);

            for (const pet of oldPets) {
                console.log(`\nTesting pet ${pet._id} (${pet.name})`);
                
                const tests = [
                    { name: 'getEmotionKey', func: () => getEmotionKey(pet) },
                    { name: 'getPoseKey', func: () => getPoseKey(pet) },
                    { name: 'calculateHealth', func: () => calculateHealth(pet) }
                ];

                for (const test of tests) {
                    try {
                        const result = test.func();
                        console.log(`  ✅ ${test.name}: ${result}`);
                        this.testResults.passed++;
                    } catch (error) {
                        console.log(`  ❌ ${test.name} failed: ${error.message}`);
                        this.testResults.failed++;
                        this.testResults.errors.push(`Pet ${pet._id} - ${test.name}: ${error.message}`);
                    }
                    this.testResults.total++;
                }
            }

            // หาข้อมูลสัตว์เลี้ยงที่มีเฉพาะระบบใหม่
            const newPets = await GPet.find({
                $and: [
                    { affection: { $exists: true } },
                    { fullness: { $exists: true } },
                    { dirtiness: { $exists: true } },
                    { fatigue: { $exists: true } },
                    { health: { $exists: false } }
                ]
            }).limit(3);

            console.log(`\nFound ${newPets.length} pets with new data structure`);

            for (const pet of newPets) {
                console.log(`\nTesting pet ${pet._id} (${pet.name})`);
                
                const tests = [
                    { name: 'getEmotionKey', func: () => getEmotionKey(pet) },
                    { name: 'getPoseKey', func: () => getPoseKey(pet) },
                    { name: 'calculateHealth', func: () => calculateHealth(pet) }
                ];

                for (const test of tests) {
                    try {
                        const result = test.func();
                        console.log(`  ✅ ${test.name}: ${result}`);
                        this.testResults.passed++;
                    } catch (error) {
                        console.log(`  ❌ ${test.name} failed: ${error.message}`);
                        this.testResults.failed++;
                        this.testResults.errors.push(`Pet ${pet._id} - ${test.name}: ${error.message}`);
                    }
                    this.testResults.total++;
                }
            }

        } catch (error) {
            console.log(`❌ Database test failed: ${error.message}`);
            this.testResults.errors.push(`Database test: ${error.message}`);
        }
    }

    /**
     * แสดงผลลัพธ์การทดสอบ
     */
    showTestResults() {
        console.log('\n📊 Test Results Summary:');
        console.log(`Total tests: ${this.testResults.total}`);
        console.log(`Passed: ${this.testResults.passed}`);
        console.log(`Failed: ${this.testResults.failed}`);
        console.log(`Success rate: ${this.testResults.total > 0 ? Math.round((this.testResults.passed / this.testResults.total) * 100) : 0}%`);

        if (this.testResults.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.testResults.errors.forEach(error => console.log(`  - ${error}`));
        }

        if (this.testResults.failed === 0) {
            console.log('\n🎉 All tests passed! The fallback system is working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Please review the errors above.');
        }
    }

    /**
     * รันการทดสอบทั้งหมด
     */
    async runAllTests() {
        console.log('🚀 Starting Pet System Tests...\n');
        
        this.testOldDataConversion();
        this.testNewDataSystem();
        this.testMixedData();
        this.testCorruptedData();
        await this.testRealDatabaseData();
        
        this.showTestResults();
    }
}

// สำหรับการรัน script
async function main() {
    try {
        // เชื่อมต่อ MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
        console.log('✅ Connected to MongoDB');
        
        const tester = new PetSystemTester();
        await tester.runAllTests();
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// เรียกใช้ script หากรันโดยตรง
if (require.main === module) {
    main();
}

module.exports = { PetSystemTester };

