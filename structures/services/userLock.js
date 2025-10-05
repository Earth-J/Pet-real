const locks = new Map();

function keyOf(guildId, userId) {
  // ใช้คีย์เสถียรต่อผู้ใช้ต่อกิลด์เพื่อป้องกันข้ามคิวกัน
  const g = guildId ?? "unknown-guild";
  const u = userId ?? "unknown-user";
  return `${g}:${u}`;
}

async function withUserLock(guildId, userId, fn) {
  const k = keyOf(guildId, userId);
  const prev = locks.get(k) || Promise.resolve();
  let release;
  const p = new Promise((resolve) => (release = resolve));
  locks.set(k, prev.then(() => p));

  try {
    await prev; // รอคิวก่อนหน้า
    return await fn();
  } finally {
    release();
    // ล้างเมื่อคิวว่าง
    const current = locks.get(k);
    if (current === p) locks.delete(k);
  }
}

module.exports = { withUserLock };