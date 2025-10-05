const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");

// เปิดใช้ CDN mapping global ตั้งแต่เริ่มโปรเซส
try { require("./structures/utils/cdn").patchCanvasLoadImageForCdn(); } catch (_) {}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageTyping,
		GatewayIntentBits.GuildVoiceStates,
	],
	partials: [Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember]
});

client.config = require('./settings/config.js');
client.owner = client.config.OWNER_ID;
client.dev = client.config.DEV_ID;
client.color = client.config.EMBED_COLOR;
if(!client.token) client.token = client.config.TOKEN;

process.on('unhandledRejection', error => console.log(error));
process.on('uncaughtException', error => console.log(error));

["slash"].forEach(x => client[x] = new Collection());
["loadCommand", "loadEvent", "loadDatabase", "PetEvents", "PoopSpawner"].forEach(x => require(`./handlers/${x}`)(client));
require("./handlers/FireStreakHandler").init(client);
require("./handlers/VoiceMoneyHandler").initVoiceMoneySystem();
require("./handlers/PetDirtinessHandler").initPetDirtinessSystem();

// เริ่มระบบพฤติกรรมสัตว์เลี้ยงที่สมบูรณ์
const { initPetBehaviorSystem } = require("./handlers/initPetBehaviorSystem");
initPetBehaviorSystem();

// เริ่มระบบการนอนสัตว์เลี้ยง
const { petSleepSystem } = require("./handlers/PetSleepSystem");
petSleepSystem.setClient(client); // ส่ง client สำหรับส่ง DM
petSleepSystem.start().catch(error => {
    console.error('[MAIN] Error starting pet sleep system:', error);
});

client.login(client.token);