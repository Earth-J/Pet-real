const locks = new Map();

function keyOf(guildId, userId) {
  return `${guildId}:${userId}`;
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