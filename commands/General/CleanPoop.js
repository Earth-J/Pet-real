const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const GHome = require("../../settings/models/house.js");
const GPet = require("../../settings/models/pet.js");
const GInv = require("../../settings/models/inventory.js");
const { getRenderQueue } = require("../../structures/services/renderQueueSingleton");
const { fetchBuffer } = require("../../structures/services/discordUpload");
const { updateFireStreak } = require("../../handlers/FireStreakHandler");

// Cooldown system
const cleanPoopCooldowns = new Map();
const CLEAN_POOP_COOLDOWN = 2 * 60 * 1000; // 2 minutes cooldown

// ตรวจสอบ cooldown
function checkCooldown(userId) {
    const now = Date.now();
    const lastUsed = cleanPoopCooldowns.get(userId);
    
    if (lastUsed && (now - lastUsed) < CLEAN_POOP_COOLDOWN) {
        const remaining = Math.ceil((CLEAN_POOP_COOLDOWN - (now - lastUsed)) / 1000);
        return remaining;
    }
    
    return 0;
}

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

// หาสล็อตที่มี poop จากฐานข้อมูล
function findPoopSlots(home) {
  const SLOT_Z_ORDER = [
    'A4','A3','A2','A1',
    'B4','B3','B2','B1',
    'C4','C3','C2','C1',
    'D4','D3','D2','D1',
  ];
  
  // อ่านข้อมูล poop จากฐานข้อมูล
  const poopSlots = [];
  for (const slot of SLOT_Z_ORDER) {
    if (home?.POOP_DATA?.[slot] === true) {
      poopSlots.push({ slot, draw: SLOT_DRAWS[slot] });
    }
  }
  
  return poopSlots;
}

// หาถุงขยะที่สามารถใช้ได้
function findAvailableTrashBag(inventory) {
  if (!inventory || !Array.isArray(inventory.item)) {
    return null;
  }
  
  // หาถุงขยะที่ยังไม่เต็ม (ใช้ถุงขยะที่มี used น้อยที่สุดก่อน)
  let availableBag = null;
  let minUsed = Infinity;
  
  for (const item of inventory.item) {
    if (item.type === "cleaning" && (item.used || 0) < item.capacity) {
      const used = item.used || 0;
      if (used < minUsed) {
        minUsed = used;
        availableBag = item;
      }
    }
  }
  
  return availableBag;
}

// ใช้ถุงขยะเก็บ poop
function useTrashBag(trashBag, poopCount) {
  const remainingCapacity = trashBag.capacity - (trashBag.used || 0);
  const canCollect = Math.min(poopCount, remainingCapacity);
  
  trashBag.used = (trashBag.used || 0) + canCollect;
  
  return {
    collected: canCollect,
    isFull: trashBag.used >= trashBag.capacity,
    remaining: trashBag.capacity - trashBag.used
  };
}

// เรนเดอร์บ้านโดยไม่มี poop
async function renderCleanHouse(home) {
  try {
    const { buildHouseLayers } = require("../../structures/services/layout");
    const houseLayers = buildHouseLayers(home);
    
    const queue = getRenderQueue();
    const payload = {
      guild: 'clean_house',
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
    console.error('Error rendering clean house:', error);
    return null;
  }
}

module.exports = {
  name: ["เก็บขี้"],
  description: "เก็บขี้สัตว์เลี้ยงของคุณ",
  category: "General",
  run: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: false });

    // ตรวจสอบ cooldown
    const cooldownRemaining = checkCooldown(interaction.user.id);
    if (cooldownRemaining > 0) {
        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setDescription(`⏰ คุณต้องรอ **${cooldownRemaining} วินาที** ก่อนที่จะทำความสะอาดบ้านได้อีกครั้ง`);
        return interaction.editReply({ embeds: [embed] });
    }

    try {
      // ตรวจสอบว่าผู้ใช้มีบ้านหรือไม่
      const home = await GHome.findOne({ 
        guild: interaction.guild.id, 
        user: interaction.user.id 
      }).lean();

      if (!home) {
        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setDescription("🏠 คุณยังไม่มีบ้าน! ใช้คำสั่ง ` /สัตว์เลี้ยง บ้าน ` เพื่อสร้างบ้านก่อน");
        return interaction.editReply({ embeds: [embed] });
      }

      // ตรวจสอบว่าผู้ใช้มี pet หรือไม่
      const pet = await GPet.findOne({ 
        guild: interaction.guild.id, 
        user: interaction.user.id 
      }).lean();

      if (!pet) {
        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setDescription("🐾 คุณยังไม่มีสัตว์เลี้ยง! ใช้คำสั่ง ` /รับสัตว์เลี้ยง ` เพื่อรับสัตว์เลี้ยงก่อน");
        return interaction.editReply({ embeds: [embed] });
      }

      // ตรวจสอบว่าผู้ใช้มี inventory หรือไม่
      const inventory = await GInv.findOne({ 
        guild: interaction.guild.id, 
        user: interaction.user.id 
      });

      if (!inventory) {
        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setDescription("🎒 คุณยังไม่มีกระเป๋า หรือระบบมีปัญหา!");
        return interaction.editReply({ embeds: [embed] });
      }

      // หา poop slots
      const poopSlots = findPoopSlots(home);
      
      if (poopSlots.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setDescription("✨ บ้านของคุณสะอาดอยู่แล้ว! ไม่มีขี้ให้ทำความสะอาด");
        return interaction.editReply({ embeds: [embed] });
      }

      // หาถุงขยะที่สามารถใช้ได้
      const trashBag = findAvailableTrashBag(inventory);
      
      if (!trashBag) {
        const embed = new EmbedBuilder()
          .setColor(client.color)
          .setDescription("🛍️ ถุงขยะของคุณหมด! ใช้คำสั่ง `/ร้านค้า` เพื่อซื้อถุงขยะ");
        return interaction.editReply({ embeds: [embed] });
      }

      // ใช้ถุงขยะเก็บ poop
      const result = useTrashBag(trashBag, poopSlots.length);
      const collectedPoop = result.collected;
      
      // ลบ poop จากฐานข้อมูล (เฉพาะที่เก็บได้)
      const updateFields = {};
      for (let i = 0; i < collectedPoop; i++) {
        const poopSlot = poopSlots[i];
        updateFields[`POOP_DATA.${poopSlot.slot}`] = false;
      }
      
      await GHome.updateOne(
        { _id: home._id },
        { $set: updateFields }
      );
      
      // อัปเดต fire streak
      await updateFireStreak(interaction.guild.id, interaction.user.id);
      
      // อัปเดต cooldown
      cleanPoopCooldowns.set(interaction.user.id, Date.now());
      
      // ลด dirtiness ของ pet
      const newDirtiness = Math.max(0, pet.dirtiness - collectedPoop);
      await GPet.updateOne(
        { _id: pet._id },
        { 
          $set: { 
            dirtiness: newDirtiness,
            cleanliness: 20 - newDirtiness
          }
        }
      );

      // ตรวจสอบว่าถุงขยะเต็มหรือไม่
      let trashBagMessage = "";
      if (result.isFull) {
        // ลบถุงขยะที่เต็มออกจาก inventory
        const trashBagIndex = inventory.item.findIndex(item => item.id === trashBag.id);
        if (trashBagIndex !== -1) {
          inventory.item.splice(trashBagIndex, 1);
          trashBagMessage = `\n🗑️ **ถุงขยะเต็มแล้ว!** ถุงขยะถูกทิ้งออกจากกระเป๋า`;
        }
      } else {
        trashBagMessage = `\n🗑️ ถุงขยะเหลือพื้นที่: ${result.remaining}/${trashBag.capacity}`;
      }
      
      // นับจำนวนถุงขยะที่เหลือ
      const remainingBags = inventory.item.filter(item => item.type === "cleaning").length;
      if (remainingBags > 0) {
        trashBagMessage += `\n📦 ถุงขยะที่เหลือ: ${remainingBags} ชิ้น`;
      }
      
      // บันทึก inventory
      await inventory.save();

      // เรนเดอร์บ้านที่สะอาดแล้ว
      const cleanHouseBuffer = await renderCleanHouse(home);
      
      const files = [];
      const embeds = [];

      if (cleanHouseBuffer) {
        const houseAttachment = new AttachmentBuilder(cleanHouseBuffer, { name: 'clean_house.png' });
        files.push(houseAttachment);
        
        const cleanEmbed = new EmbedBuilder()
          .setAuthor({ name: `${interaction.user.username}'s เก็บขี้สัตว์เลี้ยง`, iconURL: interaction.user.avatarURL() })
          .setColor(client.color)
          .setThumbnail("https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main/clean-poop.png")
          .setDescription(`🧹 ทำความสะอาดบ้านเรียบร้อย! เก็บขี้ได้ ${collectedPoop} ก้อน${trashBagMessage}\n<:exp:1424394377555607592> EXP : ${result.exp}/${result.nextexp} (+${collectedPoop})\n\n💡 **หมายเหตุ**: ใช้ \`/สัตว์เลี้ยง อาบน้ำ\` เพื่อทำความสะอาดสัตว์เลี้ยงโดยตรง`)
        
        embeds.push(cleanEmbed);
      }

      // เพิ่ม EXP (ลดจาก x2 เป็น x1 เพื่อความสมดุล)
      await GPet.updateOne(
        { _id: pet._id },
        { $inc: { exp: collectedPoop } }
      );

      await interaction.editReply({
        embeds,
      });

    } catch (error) {
      console.error('Error in cleanpoop command:', error);
      const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription("⚠️ เกิดข้อผิดพลาดในการทำความสะอาดบ้าน กรุณาลองใหม่อีกครั้ง");
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
