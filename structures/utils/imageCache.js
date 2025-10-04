const Canvas = require("@napi-rs/canvas");
const { toCdnIfLocal, patchCanvasLoadImageForCdn } = require("./cdn");
const fs = require('fs');
const path = require('path');

// เปิดใช้งานการแปลง CDN เฉพาะเมื่อ ENABLE_CDN เป็น true
const ENABLE_CDN = process.env.ENABLE_CDN === 'true';
if (ENABLE_CDN) {
    patchCanvasLoadImageForCdn();
    console.log('CDN patching enabled');
} else {
    console.log('CDN patching disabled - using local files');
}

// ฟังก์ชันโหลดรูปภาพแบบปลอดภัย
async function loadImageSafely(imagePath) {
    try {
        // ถ้าเป็น Buffer ให้ส่งผ่านไปเลย
        if (Buffer.isBuffer(imagePath)) {
            return await Canvas.loadImage(imagePath);
        }

        // ถ้าเป็น URL ให้ใช้ CDN
        if (typeof imagePath === 'string' && /^https?:\/\//i.test(imagePath)) {
            return await Canvas.loadImage(imagePath);
        }

        // สำหรับ local files ให้ใช้ file system
        if (typeof imagePath === 'string') {
            const fullPath = path.resolve(imagePath);
            if (fs.existsSync(fullPath)) {
                // ใช้ file:// protocol สำหรับ Windows
                const fileUrl = process.platform === 'win32' 
                    ? `file:///${fullPath.replace(/\\/g, '/')}`
                    : `file://${fullPath}`;
                return await Canvas.loadImage(fileUrl);
            } else {
                throw new Error(`File not found: ${fullPath}`);
            }
        }

        // fallback ให้ Canvas จัดการเอง
        return await Canvas.loadImage(imagePath);
    } catch (error) {
        console.error(`Error loading image ${imagePath}:`, error);
        throw error;
    }
}

class ImageCache {
    constructor() {
        // key -> { image, ts }
        this.cache = new Map();
        this.maxEntries = parseInt(process.env.IMAGE_CACHE_MAX_ENTRIES || '200');
        this.ttlMs = parseInt(process.env.IMAGE_CACHE_TTL_MS || '1800000'); // 30 นาที
    }

    _evictIfNeeded() {
        if (this.cache.size <= this.maxEntries) return;
        // ลบตัวที่เก่าสุดหนึ่งรายการ
        let oldestKey = null;
        let oldestTs = Infinity;
        for (const [k, v] of this.cache.entries()) {
            if (v.ts < oldestTs) { oldestTs = v.ts; oldestKey = k; }
        }
        if (oldestKey) this.cache.delete(oldestKey);
    }

    _isExpired(entry) {
        return (Date.now() - entry.ts) > this.ttlMs;
    }

    async getImage(path) {
        // ใช้ path เดิมเป็น key แต่โหลดด้วย loadImageSafely
        const key = typeof path === 'string' ? path : path.toString();
        const existing = this.cache.get(key);
        if (existing && !this._isExpired(existing)) {
            return existing.image;
        }
        
        try {
            let image;
            if (ENABLE_CDN) {
                // ใช้ CDN system เดิม
                const cdnKey = typeof path === 'string' ? toCdnIfLocal(path) : path;
                image = await Canvas.loadImage(cdnKey);
            } else {
                // ใช้ local files
                image = await loadImageSafely(path);
            }
            
            const entry = { image, ts: Date.now() };
            this.cache.set(key, entry);
            this._evictIfNeeded();
            return image;
        } catch (error) {
            console.error(`Failed to load image: ${key}`, error);
            return null;
        }
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheSize() {
        return this.cache.size;
    }
}

// สร้าง singleton instance
const imageCache = new ImageCache();

module.exports = { imageCache };