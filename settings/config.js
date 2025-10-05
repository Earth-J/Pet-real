require("dotenv").config();

const required = (name) => {
	const v = process.env[name];
	if (!v || String(v).trim() === "") {
		console.warn(`[config] Missing required env ${name}`);
	}
	return v || "";
};

module.exports = {
	TOKEN: required("TOKEN"),
	EMBED_COLOR: process.env.EMBED_COLOR || "#fec8b5",
	OWNER_ID: process.env.OWNER_ID || "",
	DEV_ID: Array.isArray(process.env.DEV_ID ? JSON.parse(process.env.DEV_ID) : undefined) ? JSON.parse(process.env.DEV_ID) : [],
	MONGO_URI: required("mongodb+srv://dankmeme:20762newsa@dankmeme.lu12x.mongodb.net/homes"),
	GUILD_ID: required("954103060924350465"),
};