const Canvas = require("@napi-rs/canvas");

// ค่าคงที่จาก ENV พร้อมค่าเริ่มต้นที่ปลอดภัย
const ASSET_BASE_URL = (process.env.ASSET_BASE_URL || "https://cdn.jsdelivr.net/gh/Earth-J/cdn-files@main").replace(/\/$/, "");
// ตั้งค่า prefix ให้ตรงกับโครงสร้างบน CDN เช่น 'assests' (ตามโค้ดเดิม) หรือเปลี่ยนเป็น 'assets' ได้ผ่าน ENV
const ASSET_PATH_PREFIX = (process.env.ASSET_PATH_PREFIX || "").replace(/^\/+|\/+$/g, "");

function isHttpUrl(str) {
	return typeof str === "string" && /^https?:\/\//i.test(str);
}

function normalizeLocalPath(p) {
	if (typeof p !== "string") return p;
	let s = p.trim();
	// แปลง backslashes (Windows) เป็น /
	s = s.replace(/\\/g, "/");
	// ตัด ./ หรือ / นำหน้า
	s = s.replace(/^\.\/+/, "").replace(/^\/+/, "");
	return s;
}

function stripAssestsPrefix(p) {
	// รองรับทั้ง assests และ assets
	let s = normalizeLocalPath(p);
	if (s.toLowerCase().startsWith("assests/")) return s.slice("assests/".length);
	if (s.toLowerCase().startsWith("assets/")) return s.slice("assets/".length);
	return s;
}

function buildCdnUrlFromLocal(localPath) {
	const rest = stripAssestsPrefix(localPath).replace(/^\/+/, "");
	const parts = [ASSET_BASE_URL];
	if (ASSET_PATH_PREFIX) parts.push(ASSET_PATH_PREFIX);
	if (rest) parts.push(rest);
	return parts.join("/");
}

// แปลง path ให้เป็น URL CDN ถ้าเป็นเส้นทางในโฟลเดอร์ assests/assets
function toCdnIfLocal(input) {
	if (Buffer.isBuffer(input)) return input; // ปล่อยผ่าน Buffer
	if (isHttpUrl(input)) return input; // ปล่อยผ่าน URL
	if (typeof input !== "string") return input; // อื่นๆ ปล่อยผ่าน
	const s = normalizeLocalPath(input);
	// ถ้าพบคำว่า assests/ หรือ assets/ ที่ต้นทาง ให้แมพไป CDN
	if (/^(assests|assets)\//i.test(s)) {
		return buildCdnUrlFromLocal(s);
	}
	// กรณีขึ้นต้นด้วย ./assests หรือ ./assets
	if (/^\.\/(assests|assets)\//i.test(input)) {
		return buildCdnUrlFromLocal(input);
	}
	// ไม่ใช่พาธโลคัลในโฟลเดอร์เป้าหมาย ปล่อยผ่าน
	return input;
}

function patchCanvasLoadImageForCdn() {
	const orig = Canvas.loadImage;
	if (!orig || orig.__cdn_patched__) return;
	async function patched(src) {
		const mapped = toCdnIfLocal(src);
		return orig(mapped);
	}
	patched.__cdn_patched__ = true;
	Canvas.loadImage = patched;
}

module.exports = { toCdnIfLocal, buildCdnUrlFromLocal, patchCanvasLoadImageForCdn }; 