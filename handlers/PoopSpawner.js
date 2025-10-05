const cron = require("node-cron");
const GPet = require("../settings/models/pet.js");
const GHome = require("../settings/models/house.js");
const Canvas = require("@napi-rs/canvas");
const { getRenderQueue } = require("../structures/services/renderQueueSingleton");
const { fetchBuffer } = require("../structures/services/discordUpload");

// URL ของรูป poop
const POOP_IMAGE_URL = "https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/poop.png";

// พิกัดสล็อตบ้าน (คัดลอกจาก Pet.js)
const SLOT_DRAWS = {
  A4: { x: 119, y: 24,  w: 102, h: 149 },
  A3: { x: 82,  y: 42,  w: 102, h: 149 },
  A2: { x: 45,  y: 61,  w: 102, h: 149 },
  A1: { x: 8,   y: 79,  w: 102, h: 149 },
  B4: { x: 155, y: 41,  w: 102, h: 149 },
  B3: { x: 118, y: 60,  w: 102, h: 149 },
  B2: { x: 81,  y: 79,  w: 102, h: 149 },
  B1: { x: 44,  y: 97,  w: 102, h: 149 },
  C4: { x: 191, y: 59,  w: 102, h: 149 },
  C3: { x: 154, y: 78,  w: 102, h: 149 },
  C2: { x: 117, y: 96,  w: 102, h: 149 },
  C1: { x: 80,  y: 114, w: 102, h: 149 },
  D4: { x: 227, y: 77,  w: 102, h: 149 },
  D3: { x: 190, y: 95,  w: 102, h: 149 },
  D2: { x: 153, y: 113, w: 102, h: 149 },
  D1: { x: 116, y: 131, w: 102, h: 149 },
};

// ตรวจว่าสล็อตถูกครอบครองหรือไม่
function isSlotOccupied(home, slot) {
  const group = slot[0];
  const groupKey = `${group}_DATA`;
  const boolKey = `${slot}`;
  const idKey = `${slot}I`;
  return Boolean(home?.[groupKey]?.[boolKey]) || Boolean(home?.[groupKey]?.[idKey]);
}

// ตรวจว่าสล็อตถูกปิดใช้งานหรือไม่
function isSlotDisabled(home, slot) {
  const group = slot[0];
  const groupKey = `${group}_DATA`;
  const disabledKey = `${slot}D`;
  return Boolean(home?.[groupKey]?.[disabledKey]);
}

// หาสล็อตว่างที่สุ่มได้
function getRandomEmptySlot(home) {
  const SLOT_Z_ORDER = [
    'A4','A3','A2','A1',
    'B4','B3','B2','B1',
    'C4','C3','C2','C1',
    'D4','D3','D2','D1',
  ];
  
  const empties = SLOT_Z_ORDER.filter(s => !isSlotOccupied(home, s) && !isSlotDisabled(home, s));
  if (empties.length === 0) return null;
  
  const randomSlot = empties[Math.floor(Math.random() * empties.length)];
  return { slot: randomSlot, draw: SLOT_DRAWS[randomSlot] };
}

// สร้าง poop layer สำหรับ render
function createPoopLayer(slotInfo) {
  if (!slotInfo) return null;
  
  // ใช้ anchor กลางด้านล่างของสล็อต และเลื่อนขึ้นเล็กน้อย
  const anchorX = slotInfo.draw.x + (slotInfo.draw.w / 2);
  const anchorY = slotInfo.draw.y + slotInfo.draw.h;
  
  const poopWidth = 26;
  const poopHeight = 26;
  let poopX = Math.round(anchorX - (poopWidth / 2));
  let poopY = Math.round(anchorY - Math.floor(poopHeight / 2) - 8);
  // clamp ให้อยู่ภายในแคนวาส 300x300
  poopX = Math.max(0, Math.min(poopX, 300 - poopWidth));
  poopY = Math.max(0, Math.min(poopY, 300 - poopHeight));
  
  return {
    type: 'static',
    url: POOP_IMAGE_URL,
    draw: { x: poopX, y: poopY, w: poopWidth, h: poopHeight }
  };
}

// เรนเดอร์บ้านพร้อม poop
async function renderHouseWithPoop(home, poopSlot) {
  try {
    const { buildHouseLayers } = require("../structures/services/layout");
    let houseLayers = buildHouseLayers(home);
    
    // เพิ่ม poop layer
    const poopLayer = createPoopLayer(poopSlot);
    if (poopLayer) {
      houseLayers.push(poopLayer);
    }
    
    const queue = getRenderQueue();
    const payload = {
      guild: 'poop_spawner',
      user: 'system',
      size: { width: 300, height: 300 },
      format: 'png',
      layers: houseLayers,
    };
    
    const { jobId } = await queue.enqueue(payload);
    const result = await queue.waitForResult(jobId);
    const buffer = await fetchBuffer(result.url);
    
    return buffer;
  } catch (error) {
    console.error('Error rendering house with poop:', error);
    return null;
  }
}

// ฟังก์ชันหลักสำหรับ spawn poop
async function spawnPoopForPets() {
  try {
    console.log('[PoopSpawner] Starting poop spawn check...');
    
    // หา pets ที่มี dirtiness > 5 และไม่ได้นอนอยู่
    const petsWithDirtiness = await GPet.find({ 
      dirtiness: { $gt: 5 },
      isSleeping: { $ne: true } // ไม่ spawn poop ถ้าสัตว์เลี้ยงกำลังนอน
    }).lean();
    
    console.log(`[PoopSpawner] Found ${petsWithDirtiness.length} pets with dirtiness (awake only)`);
    
    for (const pet of petsWithDirtiness) {
      try {
        // หาบ้านของ pet นี้
        const home = await GHome.findOne({ 
          guild: pet.guild, 
          user: pet.user 
        }).lean();
        
        if (!home) {
          console.log(`[PoopSpawner] No house found for pet in guild ${pet.guild}, user ${pet.user}`);
          continue;
        }
        
        // หาสล็อตว่างสำหรับวาง poop
        const emptySlot = getRandomEmptySlot(home);
        if (!emptySlot) {
          console.log(`[PoopSpawner] No empty slots available for pet in guild ${pet.guild}, user ${pet.user} - skipping poop spawn`);
          continue;
        }
        
        console.log(`[PoopSpawner] Spawning poop at slot ${emptySlot.slot} for pet in guild ${pet.guild}, user ${pet.user}`);
        
        // บันทึก poop ในฐานข้อมูล
        const updateField = `POOP_DATA.${emptySlot.slot}`;
        await GHome.updateOne(
          { _id: home._id },
          { $set: { [updateField]: true } }
        );
        
        console.log(`[PoopSpawner] Poop saved to database at slot ${emptySlot.slot}`);
        
        // ไม่เพิ่ม dirtiness ที่นี่ เพราะ PetDirtinessHandler จะจัดการให้
        
      } catch (error) {
        console.error(`[PoopSpawner] Error processing pet ${pet._id}:`, error);
      }
    }
    
    console.log('[PoopSpawner] Poop spawn check completed');
  } catch (error) {
    console.error('[PoopSpawner] Error in spawnPoopForPets:', error);
  }
}

module.exports = async (client) => {
  console.log('[PoopSpawner] Initializing poop spawner...');
  
  // ตั้งค่าให้ spawn poop ทุก 30 นาที
  cron.schedule("*/30 * * * *", async () => {
    await spawnPoopForPets();
  });
  
  console.log('[PoopSpawner] Poop spawner initialized - will spawn poop every 30 minutes');
};
