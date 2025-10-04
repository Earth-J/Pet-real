const { readdirSync } = require('fs');

module.exports = async (client) => {
    const loadcommand = dirs =>{
        const events = readdirSync(`./events/${dirs}/`).filter(d => d.endsWith('.js'));
        for (let file of events) {
            const evt = require(`../events/${dirs}/${file}`);
            const eName = file.split('.')[0];
            
            // ตรวจสอบว่า evt เป็น function หรือ object
            if (typeof evt === 'function') {
                client.on(eName, evt.bind(null, client));
            } else if (evt.name && evt.execute) {
                // สำหรับ Discord.js v14+ event format
                client.on(evt.name, evt.execute);
            } else {
                console.warn(`[WARNING] Event ${file} is not in the correct format`);
            }
        }
    };
    ["client", "guild"].forEach((x) => loadcommand(x));
    console.log("[INFO] Events are Loaded!");
};