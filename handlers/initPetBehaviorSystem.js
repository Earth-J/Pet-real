/**
 * ไฟล์เริ่มต้นระบบพฤติกรรมสัตว์เลี้ยง
 * รวมทุกระบบเข้าด้วยกันและเริ่มทำงาน
 */

const { petGameLoop } = require('./PetGameLoop');
const { petBehaviorSystem } = require('./PetBehaviorSystem');

/**
 * เริ่มระบบพฤติกรรมสัตว์เลี้ยงทั้งหมด
 */
function initPetBehaviorSystem() {
    try {
        console.log('[INIT_PET_BEHAVIOR] Initializing complete pet behavior system...');
        
        // เริ่มระบบวัฏจักรเกม (ซึ่งจะเริ่มระบบพฤติกรรมด้วย)
        petGameLoop.start();
        
        console.log('[INIT_PET_BEHAVIOR] Pet behavior system initialized successfully');
        console.log('[INIT_PET_BEHAVIOR] Systems started:');
        console.log('  - Pet Behavior System (core stats, mood, reactions)');
        console.log('  - Pet Game Loop (tick processing, stat interactions)');
        console.log('  - Pet Health System (health calculation, care recommendations)');
        console.log('  - Pet Emotion System (emote calculation)');
        console.log('  - Pet Pose System (pose calculation)');
        
        return true;
    } catch (error) {
        console.error('[INIT_PET_BEHAVIOR] Error initializing pet behavior system:', error);
        return false;
    }
}

/**
 * หยุดระบบพฤติกรรมสัตว์เลี้ยงทั้งหมด
 */
function stopPetBehaviorSystem() {
    try {
        console.log('[INIT_PET_BEHAVIOR] Stopping pet behavior system...');
        
        petGameLoop.stop();
        
        console.log('[INIT_PET_BEHAVIOR] Pet behavior system stopped successfully');
        return true;
    } catch (error) {
        console.error('[INIT_PET_BEHAVIOR] Error stopping pet behavior system:', error);
        return false;
    }
}

/**
 * ได้รับสถานะระบบ
 */
function getSystemStatus() {
    return {
        gameLoop: petGameLoop.getStats(),
        behaviorSystem: {
            isRunning: petBehaviorSystem.isRunning,
            lastTick: petBehaviorSystem.lastTick
        }
    };
}

module.exports = {
    initPetBehaviorSystem,
    stopPetBehaviorSystem,
    getSystemStatus
};

