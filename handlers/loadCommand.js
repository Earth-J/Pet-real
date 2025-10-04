const chillout = require("chillout");
const readdirRecursive = require("recursive-readdir");
const { resolve, relative } = require("path");

module.exports = async (client) => {
    let interactionsPath = resolve("./commands");
    let interactionFiles = await readdirRecursive(interactionsPath);

    await chillout.forEach(interactionFiles, (interactionFile) => {
        const start = Date.now();
        const rltPath = relative(__dirname, interactionFile);
     //   console.log(`[INFO] Loading interaction at.. "${interactionFile}"`)
        const command = require(interactionFile);

        // ตรวจสอบว่า command.name มีอยู่และเป็น array หรือ string
        if (!command.name) {
            console.log(`[WARN] "${rltPath}" The interaction file does not have a name. Skipping..`);
            return;
        }

        // แปลง name เป็น array หากเป็น string
        if (typeof command.name === 'string') {
            command.name = [command.name];
        }

        // ตรวจสอบว่า name เป็น array และมีข้อมูล
        if (!Array.isArray(command.name) || command.name.length === 0) {
            console.log(`[WARN] "${rltPath}" The interaction file has invalid name format. Skipping..`);
            return;
        }

        if (command.name.length > 3) {
            console.log(`[WARN] "${rltPath}" The name list of the interaction file is too long. (>3) Skipping..`);
            return;
        }

        if (client.slash.has(command.name)) {
            console.log(`[WARN] "${command.name[1]}" interaction has already been installed. It's skipping.`)
            return;
        }

        client.slash.set(command.name, command);
     //   console.log(`[INFO] "${command.type == "CHAT_INPUT" ? `/${command.name.join(" ")}` : `${command.name[0]}`}" ${command.name[1] || ""}  ${command.name[2] || ""} The interaction has been uploaded. (it took ${Date.now() - start}ms)`);
        });

        if (client.slash.size) {
            console.log(`[INFO] ${client.slash.size} Interactions are Loaded!`);
        } else {
            console.log(`[WARN] No interactions loaded, is everything ok?`);
        }
}