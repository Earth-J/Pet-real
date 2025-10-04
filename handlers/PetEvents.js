//// use node-cron 
const cron = require("node-cron");
const GPet = require("../settings/models/pet.js");
const Canvas = require("@napi-rs/canvas");

module.exports = async (client) => {
    // 30 minutes hunger
    cron.schedule("*/30 * * * *", async () => {
        const pet = await GPet.find();
        for (const data of pet) {
            if (data.hungry > 0) {
                data.hungry -= 1;
                data.save();
            }
        }
        // if pet hungry is 0, pet hp will decrease
        const pet2 = await GPet.find();
        for (const data of pet2) {
            if (data.hungry === 0) {
                data.hp -= 1;
                data.save();
            }
        }
    });
    // 10 minutes // regem health
//    cron.schedule("*/10 * * * *", async () => {
//        const pet3 = await GPet.find();
//        for (const data of pet3) {
//            if (data.hp > 20) {
//                data.hp = 20;
//                data.save();
//            }
//        }
//    });
}

