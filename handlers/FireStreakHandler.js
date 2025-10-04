const cron = require("node-cron");
const GPet = require("../settings/models/pet.js");

// ฟังก์ชันสำหรับอัปเดต fire streak
async function updateFireStreak(guildId, userId) {
  try {
    const pet = await GPet.findOne({ guild: guildId, user: userId });
    if (!pet) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastActivityDate = pet.lastActivityDate || '';

    // ถ้าเป็นวันใหม่
    if (lastActivityDate !== today) {
      // ถ้าเป็นวันต่อเนื่อง (วันก่อน + 1 วัน)
      if (lastActivityDate && isConsecutiveDay(lastActivityDate, today)) {
        pet.fireStreak += 1;
      } else {
        // ถ้าไม่ต่อเนื่อง ให้รีเซ็ต
        pet.fireStreak = 1;
      }
      
      pet.lastActivityDate = today;
      await pet.save();
      
      console.log(`[FireStreak] Updated streak for user ${userId} in guild ${guildId}: ${pet.fireStreak} days`);
    }
  } catch (error) {
    console.error('[FireStreak] Error updating fire streak:', error);
  }
}

// ตรวจสอบว่าวันต่อเนื่องกันหรือไม่
function isConsecutiveDay(lastDate, currentDate) {
  const last = new Date(lastDate);
  const current = new Date(currentDate);
  const diffTime = current - last;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

// ฟังก์ชันสำหรับรีเซ็ต fire streak ที่ขาดต่อเนื่อง
async function resetBrokenStreaks() {
  try {
    console.log('[FireStreak] Checking for broken streaks...');
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // หา pets ที่ไม่ได้ใช้งานใน 2 วัน
    const pets = await GPet.find({
      lastActivityDate: { 
        $exists: true, 
        $ne: '', 
        $nin: [today, yesterday] 
      }
    });

    let resetCount = 0;
    for (const pet of pets) {
      if (pet.fireStreak > 0) {
        pet.fireStreak = 0;
        await pet.save();
        resetCount++;
      }
    }

    if (resetCount > 0) {
      console.log(`[FireStreak] Reset ${resetCount} broken streaks`);
    }
  } catch (error) {
    console.error('[FireStreak] Error resetting broken streaks:', error);
  }
}

// ฟังก์ชันสำหรับแสดง fire streak emoji
function getFireStreakEmoji(streak) {
  if (streak === 0) return '';
  return '🔥';
}

// ฟังก์ชันสำหรับแสดง fire streak text
function getFireStreakText(streak) {
  if (streak === 0) return '';
  if (streak === 1) return `1 🔥`;
  return `${streak} 🔥`;
}

module.exports = {
  updateFireStreak,
  resetBrokenStreaks,
  getFireStreakEmoji,
  getFireStreakText,
  
  // เริ่มต้น handler
  init: async (client) => {
    console.log('[FireStreak] Initializing fire streak handler...');
    
    // รีเซ็ต streaks ที่ขาดต่อเนื่องทุกวันเวลา 00:00 UTC
    cron.schedule("0 0 * * *", async () => {
      await resetBrokenStreaks();
    });
    
    console.log('[FireStreak] Fire streak handler initialized');
  }
};
