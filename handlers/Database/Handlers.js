const GHome = require("../../settings/models/house.js");
const GPet = require("../../settings/models/pet.js");
const GInv = require("../../settings/models/inventory.js")
const GProfile = require("../../settings/models/profile.js");

module.exports = async (client) => {

    client.createHome = async function (guildId, userId) {
        const database = await GHome.findOne({ guild: guildId, user: userId });
        if (!database) {
            const newHome = await GHome.create({
                guild: guildId,
                user: userId,
                house: "https://i.imgur.com/vwHTvOv.gif",
                A_DATA: {
                    A1: false,
                    A1I: "",
                    A1D: false,

                    A2: false,
                    A2I: "",
                    A2D: false,

                    A3: false,
                    A3I: "",
                    A3D: false,

                    A4: false,
                    A4I: "",
                    A4D: true
                },
                B_DATA: {
                    B1: false,
                    B1I: "",
                    B1D: false,

                    B2: false,
                    B2I: "",
                    B2D: false,

                    B3: false,
                    B3I: "",
                    B3D: false,

                    B4: false,
                    B4I: "",
                    B4D: true
                },
                C_DATA: {
                    C1: false,
                    C1I: "",
                    C1D: false,

                    C2: false,
                    C2I: "",
                    C2D: false,

                    C3: false,
                    C3I: "",
                    C3D: false,

                    C4: false,
                    C4I: "",
                    C4D: true
                },
                D_DATA: {
                    D1: false,
                    D1I: "",
                    D1D: false,

                    D2: false,
                    D2I: "",
                    D2D: false,

                    D3: false,
                    D3I: "",
                    D3D: false,

                    D4: false,
                    D4I: "",
                    D4D: true
                },
                FLOOR_DATA: {
                    FLOOR: false,
                    FLOORI: "",
                    FLOORD: false
                },
                WALL_DATA: {
                    L1: false,
                    L1I: "",
                    L1D: false,
                    ///
                    L2: false,
                    L2I: "",
                    L2D: false,
                    ///
                    L3: false,
                    L3I: "",
                    L3D: false,
                    ///
                    L4: false,
                    L4I: "",
                    L4D: true,
                    ///
                    R1: false,
                    R1I: "",
                    R1D: false,
                    ///
                    R2: false,
                    R2I: "",
                    R2D: false,
                    ///
                    R3: false,
                    R3I: "",
                    R3D: false,
                    ///
                    R4: false,
                    R4I: "",
                    R4D: true,
                }
            });
            await newHome.save();
        }
    };

    client.createInv = async function (guildId, userId) {
        const database = await GInv.findOne({ guild: guildId, user: userId });
        if (!database) {
            const newInv = await GInv.create({
                guild: guildId,
                user: userId,
                item: []
            });
            await newInv.save();
        }
    };

    client.createProfile = async function (guildId, userId) {
        const database = await GProfile.findOne({ guild: guildId, user: userId });
        if (!database) {
            const newHome = await GProfile.create({
                guild: guildId,
                user: userId,
                level: 1,
                money: 1000,
                tokens: 0,
                bank: 0,
                inventory: 100
            });
            await newHome.save();
        }
    };

    client.createPet = async function (guildId, userId) {
        const database = await GPet.findOne({ guild: guildId, user: userId });
        if (!database) {
            const newPet = await GPet.create({
                guild: guildId,
                user: userId,
                name: "Unnamed Pet",
                type: "dog",
                id: "default_pet",
                price: 0,
                exp: 0,
                level: 1,
                nextexp: 2,
                // ค่ารุ่นเก่า (backward compatibility)
                health: 20,
                hungry: 20,
                sleep: 20,
                cleanliness: 20,
                // ค่ารุ่นใหม่
                affection: 20,
                fullness: 20,
                dirtiness: 0,
                fatigue: 0,
                fireStreak: 0,
                lastActivityDate: '',
                spriteGifUrl: ''
            });
            await newPet.save();
        }
    };


} 