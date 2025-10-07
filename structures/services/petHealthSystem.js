/**
 * ระบบสุขภาพรวม (Health System) สำหรับสัตว์เลี้ยง
 * คำนวณสุขภาพจากค่าหลัก 4 ตัว: Fatigue, Affection, Fullness, Dirtiness
 * และจัดการความสัมพันธ์ระหว่างค่าสถานะต่างๆ
 */

const STAT_RANGES = {
    MIN: 1,
    MAX: 20,
    DEFAULT: 20
};

/**
 * คำนวณสุขภาพรวมจากค่าหลักทั้งหมด
 * สุขภาพสะท้อนความสมดุลของทุกอย่างในร่างกายสัตว์
 */
function calculateHealth(petDoc) {
    if (!petDoc) return STAT_RANGES.DEFAULT;

    // Fallback สำหรับข้อมูลเก่า: แปลงจากระบบเก่าเป็นระบบใหม่
    let affection, fullness, dirtiness, fatigue;
    
    if (typeof petDoc.affection !== 'undefined') {
        // ใช้ระบบใหม่
        affection = Number(petDoc.affection ?? 0);
        fullness = Number(petDoc.fullness ?? 0);
        dirtiness = Number(petDoc.dirtiness ?? 0);
        fatigue = Number(petDoc.fatigue ?? 0);
    } else {
        // ใช้ระบบเก่า + แปลงเป็นระบบใหม่
        affection = Number(petDoc.health ?? 20);           // health → affection
        fullness = Number(petDoc.hungry ?? 20);            // hungry → fullness
        dirtiness = Math.max(0, 20 - Number(petDoc.cleanliness ?? 20)); // cleanliness → dirtiness (inverted)
        fatigue = Math.max(0, 20 - Number(petDoc.sleep ?? 20));       // sleep → fatigue (inverted)
    }

    // คำนวณคะแนนสุขภาพสำหรับแต่ละค่า (0-1)
    const affectionScore = affection / STAT_RANGES.MAX;
    const fullnessScore = fullness / STAT_RANGES.MAX;
    const cleanlinessScore = (STAT_RANGES.MAX - dirtiness) / STAT_RANGES.MAX;
    const energyScore = (STAT_RANGES.MAX - fatigue) / STAT_RANGES.MAX;

    // คำนวณสุขภาพรวม (เฉลี่ยของทุกค่า)
    const healthScore = (affectionScore + fullnessScore + cleanlinessScore + energyScore) / 4;
    
    // แปลงเป็นค่า 1-20
    return Math.round(healthScore * STAT_RANGES.MAX);
}

/**
 * ตรวจสอบสถานะสุขภาพ
 */
function getHealthStatus(health) {
    if (health >= 18) return 'excellent';      // ดีเยี่ยม
    if (health >= 15) return 'good';           // ดี
    if (health >= 12) return 'fair';           // พอใช้
    if (health >= 8) return 'poor';            // แย่
    return 'critical';                          // วิกฤต
}

/**
 * ได้รับคำอธิบายสถานะสุขภาพเป็นภาษาไทย
 */
function getHealthDescription(healthStatus) {
    const descriptions = {
        'excellent': 'สุขภาพดีเยี่ยม',
        'good': 'สุขภาพดี',
        'fair': 'สุขภาพพอใช้',
        'poor': 'สุขภาพแย่',
        'critical': 'สุขภาพวิกฤต'
    };
    return descriptions[healthStatus] || 'ไม่ทราบ';
}

/**
 * ได้รับคำแนะนำตามสถานะสุขภาพ
 */
function getHealthAdvice(healthStatus) {
    const advice = {
        'excellent': 'สัตว์เลี้ยงมีสุขภาพดีเยี่ยม ควรรักษาสถานะนี้ไว้',
        'good': 'สัตว์เลี้ยงมีสุขภาพดี ควรดูแลต่อเนื่อง',
        'fair': 'สัตว์เลี้ยงมีสุขภาพพอใช้ ควรดูแลเพิ่มเติม',
        'poor': 'สัตว์เลี้ยงมีสุขภาพแย่ ควรดูแลอย่างใกล้ชิด',
        'critical': 'สัตว์เลี้ยงมีสุขภาพวิกฤต ต้องดูแลทันที!'
    };
    return advice[healthStatus] || 'ควรดูแลสัตว์เลี้ยงตามปกติ';
}

/**
 * คำนวณผลกระทบของความสัมพันธ์ระหว่างค่าสถานะต่างๆ
 * ระบบนี้ทำให้เกมไม่เป็นแค่ "ค่า 4 ช่อง" แต่รู้สึกเหมือนสิ่งมีชีวิต
 */
function calculateStatInteractions(petDoc) {
    if (!petDoc) return {};

    const affection = Number(petDoc.affection ?? 0);
    const fullness = Number(petDoc.fullness ?? 0);
    const dirtiness = Number(petDoc.dirtiness ?? 0);
    const fatigue = Number(petDoc.fatigue ?? 0);

    const interactions = {};

    // 1. ถ้าหิวมาก (Fullness ต่ำ) → fatigue จะเพิ่มเร็วขึ้น เพราะไม่มีพลังงาน
    if (fullness <= 4) {
        interactions.fatigueMultiplier = 1.5; // fatigue เพิ่มเร็วขึ้น 50%
    }

    // 2. ถ้าสกปรกมาก (Dirtiness สูง) → affection จะค่อยๆ ลด เพราะอารมณ์เสีย
    if (dirtiness >= 15) {
        interactions.affectionPenalty = -0.5; // affection ลด 0.5 ต่อ tick
    }

    // 3. ถ้าล้ามาก → affection จะขึ้นช้าเวลาพาไปเล่น เพราะเหนื่อยเกินจะสนุก
    if (fatigue >= 15) {
        interactions.playAffectionMultiplier = 0.5; // affection จากเล่นเพิ่มขึ้นช้า 50%
    }

    // 4. ถ้านอนเพียงพอ → affection จะฟื้นขึ้นเล็กน้อย
    if (fatigue <= 5) {
        interactions.restAffectionBonus = 0.2; // affection ฟื้นขึ้น 0.2 ต่อ tick
    }

    // 5. ถ้า affection สูง → fatigue ลดลงเร็วขึ้นเมื่อนอน
    if (affection >= 15) {
        interactions.sleepFatigueMultiplier = 1.3; // fatigue ลดเร็วขึ้น 30% เมื่อนอน
    }

    // 6. ถ้า fullness สูงมาก → fatigue เพิ่มขึ้นเล็กน้อย (อิ่มเกินไป)
    if (fullness >= 18) {
        interactions.overeatFatiguePenalty = 0.3; // fatigue เพิ่มขึ้น 0.3 ต่อ tick
    }

    // 7. ถ้า affection ต่ำมาก → fullness ลดลงเร็วขึ้น (เครียดกินไม่ลง)
    if (affection <= 3) {
        interactions.stressFullnessPenalty = 0.5; // fullness ลดเร็วขึ้น 50%
    }

    return interactions;
}

/**
 * ประมวลผลผลกระทบของความสัมพันธ์ระหว่างค่าสถานะ
 */
function applyStatInteractions(stats, interactions) {
    const newStats = { ...stats };

    // ใช้ผลกระทบต่างๆ
    if (interactions.fatigueMultiplier) {
        newStats.fatigue = Math.min(STAT_RANGES.MAX, 
            newStats.fatigue * interactions.fatigueMultiplier);
    }

    if (interactions.affectionPenalty) {
        newStats.affection = Math.max(STAT_RANGES.MIN, 
            newStats.affection + interactions.affectionPenalty);
    }

    if (interactions.restAffectionBonus) {
        newStats.affection = Math.min(STAT_RANGES.MAX, 
            newStats.affection + interactions.restAffectionBonus);
    }

    if (interactions.overeatFatiguePenalty) {
        newStats.fatigue = Math.min(STAT_RANGES.MAX, 
            newStats.fatigue + interactions.overeatFatiguePenalty);
    }

    if (interactions.stressFullnessPenalty) {
        newStats.fullness = Math.max(STAT_RANGES.MIN, 
            newStats.fullness - interactions.stressFullnessPenalty);
    }

    // ตรวจสอบขอบเขต
    newStats.fatigue = Math.max(STAT_RANGES.MIN, Math.min(STAT_RANGES.MAX, Math.round(newStats.fatigue)));
    newStats.affection = Math.max(STAT_RANGES.MIN, Math.min(STAT_RANGES.MAX, Math.round(newStats.affection)));
    newStats.fullness = Math.max(STAT_RANGES.MIN, Math.min(STAT_RANGES.MAX, Math.round(newStats.fullness)));
    newStats.dirtiness = Math.max(STAT_RANGES.MIN, Math.min(STAT_RANGES.MAX, Math.round(newStats.dirtiness)));

    return newStats;
}

/**
 * ตรวจสอบว่าสัตว์เลี้ยงต้องการการดูแลเร่งด่วนหรือไม่
 */
function needsUrgentCare(petDoc) {
    if (!petDoc) return false;

    const health = calculateHealth(petDoc);
    const healthStatus = getHealthStatus(health);
    
    // ถ้าสุขภาพวิกฤต หรือมีค่าต่ำมาก
    if (healthStatus === 'critical') return true;
    
    const affection = Number(petDoc.affection ?? 0);
    const fullness = Number(petDoc.fullness ?? 0);
    const dirtiness = Number(petDoc.dirtiness ?? 0);
    const fatigue = Number(petDoc.fatigue ?? 0);

    // ตรวจสอบค่าที่ต่ำมาก
    if (affection <= 2 || fullness <= 2 || fatigue >= 18 || dirtiness >= 18) {
        return true;
    }

    return false;
}

/**
 * ได้รับคำแนะนำการดูแลตามสถานะปัจจุบัน
 */
function getCareRecommendations(petDoc) {
    if (!petDoc) return [];

    const recommendations = [];
    const affection = Number(petDoc.affection ?? 0);
    const fullness = Number(petDoc.fullness ?? 0);
    const dirtiness = Number(petDoc.dirtiness ?? 0);
    const fatigue = Number(petDoc.fatigue ?? 0);

    // ตรวจสอบความต้องการเร่งด่วน
    if (fullness <= 4) {
        recommendations.push({
            priority: 'urgent',
            action: 'feed',
            message: 'สัตว์เลี้ยงหิวมาก ควรให้อาหารทันที',
            emoji: '🍖'
        });
    }

    if (dirtiness >= 15) {
        recommendations.push({
            priority: 'urgent',
            action: 'clean',
            message: 'สัตว์เลี้ยงสกปรกมาก ควรอาบน้ำทันที',
            emoji: '🧼'
        });
    }

    if (fatigue >= 15) {
        recommendations.push({
            priority: 'high',
            action: 'sleep',
            message: 'สัตว์เลี้ยงเหนื่อยมาก ควรให้พักผ่อน',
            emoji: '💤'
        });
    }

    if (affection <= 5) {
        recommendations.push({
            priority: 'high',
            action: 'play',
            message: 'สัตว์เลี้ยงต้องการความสนใจ ควรเล่นด้วย',
            emoji: '🎾'
        });
    }

    // ตรวจสอบความต้องการทั่วไป
    if (fullness <= 8 && fullness > 4) {
        recommendations.push({
            priority: 'medium',
            action: 'feed',
            message: 'สัตว์เลี้ยงเริ่มหิว ควรให้อาหาร',
            emoji: '🍖'
        });
    }

    if (dirtiness >= 10 && dirtiness < 15) {
        recommendations.push({
            priority: 'medium',
            action: 'clean',
            message: 'สัตว์เลี้ยงเริ่มสกปรก ควรทำความสะอาด',
            emoji: '🧼'
        });
    }

    if (fatigue >= 10 && fatigue < 15) {
        recommendations.push({
            priority: 'medium',
            action: 'sleep',
            message: 'สัตว์เลี้ยงเริ่มเหนื่อย ควรให้พักผ่อน',
            emoji: '💤'
        });
    }

    if (affection <= 10 && affection > 5) {
        recommendations.push({
            priority: 'medium',
            action: 'play',
            message: 'สัตว์เลี้ยงต้องการความสนใจ ควรเล่นด้วย',
            emoji: '🎾'
        });
    }

    // เรียงลำดับตามความสำคัญ
    const priorityOrder = { 'urgent': 1, 'high': 2, 'medium': 3, 'low': 4 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
}

module.exports = {
    calculateHealth,
    getHealthStatus,
    getHealthDescription,
    getHealthAdvice,
    calculateStatInteractions,
    applyStatInteractions,
    needsUrgentCare,
    getCareRecommendations,
    STAT_RANGES
};


