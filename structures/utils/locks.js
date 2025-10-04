class KeyedAsyncLock {
  constructor() {
    this.keyToPromise = new Map();
  }

  async acquire(key) {
    const previous = this.keyToPromise.get(key) || Promise.resolve();
    let releaseResolve;
    const current = new Promise((res) => { releaseResolve = res; });
    this.keyToPromise.set(key, previous.then(() => current));
    await previous;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseResolve();
      // ถ้า current คือ promise ล่าสุดให้ลบ
      if (this.keyToPromise.get(key) === current) this.keyToPromise.delete(key);
    };
  }
}

const globalLock = new KeyedAsyncLock();

async function withLock(key, fn) {
  const release = await globalLock.acquire(key);
  try {
    return await fn();
  } finally {
    release();
  }
}

module.exports = { withLock }; 