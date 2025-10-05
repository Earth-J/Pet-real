require("dotenv").config();

const required = (name) => {
	const v = process.env[name];
	if (!v || String(v).trim() === "") {
		console.warn(`[config] Missing required env ${name}`);
	}
	return v || "";
};

function getDevIds() {
	try {
		// รองรับ JSON array ใน ENV เช่น '["123","456"]'
		const parsed = JSON.parse(process.env.DEV_ID || "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		// ถ้าไม่ใช่ JSON ให้ลองแบบคอมมาเช่น 123,456
		const csv = (process.env.DEV_ID || "")
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		return csv;
	}
}

module.exports = {
	TOKEN: required("TOKEN"),
	EMBED_COLOR: process.env.EMBED_COLOR || "#fec8b5",
	OWNER_ID: process.env.OWNER_ID || "",
	DEV_ID: getDevIds(),
	MONGO_URI: required("MONGO_URI"),
	GUILD_ID: required("GUILD_ID"),
};
