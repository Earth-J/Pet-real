const cron = require('node-cron');
const GPet = require("../settings/models/pet.js");

// เพิ่มความสกปรกของ pet ทุกๆ 10 นาที
function initPetDirtinessSystem() {
    console.log('[PET_DIRTINESS] Initializing pet dirtiness system...');
    
    // รันทุกๆ 10 นาที
    cron.schedule('*/10 * * * *', async () => {
        try {
            await updateAllPetsDirtiness();
        } catch (error) {
            console.error('[PET_DIRTINESS] Error updating pet dirtiness:', error);
        }
    });
    
    console.log('[PET_DIRTINESS] Pet dirtiness system started - will update every 10 minutes');
}

// อัปเดตความสกปรกของ pet ทั้งหมด
async function updateAllPetsDirtiness() {
    try {
        // หา pet ทั้งหมดที่มีความสกปรกน้อยกว่า 20 และไม่ได้นอนอยู่
        const pets = await GPet.find({ 
            dirtiness: { $lt: 20 },
            isSleeping: { $ne: true } // ไม่เพิ่มความสกปรกถ้าสัตว์เลี้ยงกำลังนอน
        });
        
        // หา pet ทั้งหมดในฐานข้อมูลเพื่อ debug
        const totalPets = await GPet.countDocuments();
        console.log(`[PET_DIRTINESS] Total pets in database: ${totalPets}`);
        console.log(`[PET_DIRTINESS] Pets with dirtiness < 20: ${pets.length}`);
        
        if (totalPets === 0) {
            console.log('[PET_DIRTINESS] No pets in database - users need to use /pet starter command first');
            return;
        }
        
        if (pets.length === 0) {
            console.log('[PET_DIRTINESS] No pets found to update (all pets may already be at max dirtiness)');
            return;
        }
        
        let updatedCount = 0;
        
        for (const pet of pets) {
            // เพิ่มความสกปรก 1 หน่วย (ลดจาก 2 เพื่อความสมจริง)
            const newDirtiness = Math.min(20, pet.dirtiness + 1);
            
            // อัปเดตในฐานข้อมูล (ลบการอัปเดต cleanliness เพราะไม่ได้ใช้แล้ว)
            await GPet.updateOne(
                { _id: pet._id },
                { 
                    $set: { 
                        dirtiness: newDirtiness
                    }
                }
            );
            
            updatedCount++;
            
            console.log(`[PET_DIRTINESS] Updated pet ${pet._id}: dirtiness ${pet.dirtiness} -> ${newDirtiness}`);
        }
        
        console.log(`[PET_DIRTINESS] Updated ${updatedCount} pets' dirtiness levels`);
        
    } catch (error) {
        console.error('[PET_DIRTINESS] Error updating all pets dirtiness:', error);
    }
}

// อัปเดตความสกปรกของ pet เฉพาะ
async function updatePetDirtiness(petId, amount = 1) {
    try {
        const pet = await GPet.findById(petId);
        
        if (!pet) {
            console.log(`[PET_DIRTINESS] Pet ${petId} not found`);
            return;
        }
        
        const newDirtiness = Math.min(20, pet.dirtiness + amount);
        
        await GPet.updateOne(
            { _id: petId },
            { 
                $set: { 
                    dirtiness: newDirtiness
                }
            }
        );
        
        console.log(`[PET_DIRTINESS] Updated pet ${petId}: dirtiness ${pet.dirtiness} -> ${newDirtiness}`);
        
        return {
            oldDirtiness: pet.dirtiness,
            newDirtiness: newDirtiness
        };
        
    } catch (error) {
        console.error(`[PET_DIRTINESS] Error updating pet ${petId} dirtiness:`, error);
        return null;
    }
}

module.exports = {
    initPetDirtinessSystem,
    updateAllPetsDirtiness,
    updatePetDirtiness
};
