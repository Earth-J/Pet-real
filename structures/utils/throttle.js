const lastTouchByKey = new Map();

function shouldThrottle(key, windowMs) {
  const now = Date.now();
  const last = lastTouchByKey.get(key) || 0;
  if (now - last < windowMs) return true;
  lastTouchByKey.set(key, now);
  return false;
}

function touch(key) {
  lastTouchByKey.set(key, Date.now());
}

module.exports = { shouldThrottle, touch }; 