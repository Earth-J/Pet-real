const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const GHome = require("../../settings/models/house.js");
const GPet = require("../../settings/models/pet.js");
const GInv = require("../../settings/models/inventory.js");
const { getRenderQueue } = require("../../structures/services/renderQueueSingleton");
const { fetchBuffer } = require("../../structures/services/discordUpload");
const { updateFireStreak } = require("../../handlers/FireStreakHandler");
const { petBehaviorSystem } = require("../../handlers/PetBehaviorSystem");

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

// ใช้ค่ากลางของพิกัดสล็อต poop
const { SLOT_DRAWS, SLOT_ORDER } = require("../../structures/constants/poopSlots");

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
  const SLOT_Z_ORDER = SLOT_ORDER;
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

      // คำนวณและอัปเดต EXP/Level/Nextexp ให้ถูกต้องตามสูตรเดียวกับระบบหลัก
      const petDoc = await GPet.findOne({ _id: pet._id });
      // EXP จากการเก็บขี้: เท่ากับจำนวนที่เก็บได้
      const gain = Math.max(0, Number(collectedPoop || 0));
      let exp = Number(petDoc?.exp || 0) + gain;
      let level = Number(petDoc?.level || 1);
      let nextexp = Number(petDoc?.nextexp || petBehaviorSystem.computeNextExp(level));
      let leveledUp = false;

      while (exp >= nextexp) {
        exp = exp - nextexp;
        level += 1;
        nextexp = petBehaviorSystem.computeNextExp(level);
        leveledUp = true;
      }

      await GPet.updateOne(
        { _id: pet._id },
        { $set: { exp, level, nextexp } }
      );

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
          .setDescription(`🧹 ทำความสะอาดบ้านเรียบร้อย! เก็บขี้ได้ ${collectedPoop} ก้อน${trashBagMessage}\n<:exp:1424394377555607592> EXP : ${exp}/${nextexp} (+${gain})${leveledUp ? `\n**เลเวลอัป!** → เลเวล ${level} 🎉` : ''}\n\n💡 **หมายเหตุ**: ใช้ \`/สัตว์เลี้ยง อาบน้ำ\` เพื่อทำความสะอาดสัตว์เลี้ยงโดยตรง`)
        
        embeds.push(cleanEmbed);
      }

      await interaction.editReply({
        embeds,
        files
      });

      if (leveledUp) {
        try {
          const lvlEmbed = new EmbedBuilder()
            .setColor('#c9ce93')
            .setTitle('🎉 Level Up!')
            .setDescription(`${interaction.user} สัตว์เลี้ยงเลเวลอัปเป็นเลเวล **${level}**!`);
          await interaction.followUp({ embeds: [lvlEmbed], ephemeral: false });
        } catch {}
      }

    } catch (error) {
      console.error('Error in cleanpoop command:', error);
      const embed = new EmbedBuilder()
        .setColor(client.color)
        .setDescription("⚠️ เกิดข้อผิดพลาดในการทำความสะอาดบ้าน กรุณาลองใหม่อีกครั้ง");
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
