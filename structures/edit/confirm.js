const { ActionRowBuilder, ButtonStyle, ButtonBuilder } = require("discord.js");
const GInv = require("../../settings/models/inventory.js");
const GHouse = require("../../settings/models/house.js");

function getFinalUrl(message, renderUrl) {
    return renderUrl || (message && message.attachments && message.attachments.first && message.attachments.first() && message.attachments.first().url) || undefined;
}

const saveA1 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_a1")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_a1")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_a1") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_a1") {
                if(check.area === 2) {
                    home.A_DATA.A2 = false
                    home.A_DATA.A2I = "";
                    /// save A3
                    home.A_DATA.A3 = false
                } else {
                    home.A_DATA.A2 = false
                    home.A_DATA.A2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.A_DATA.A2 = false
                home.A_DATA.A2I = "";
                /// save A3
                home.A_DATA.A3 = false
            } else {
                home.A_DATA.A2 = false
                home.A_DATA.A2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveA2 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_a2")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_a2")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_a2") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_a2") {
                if(check.area === 2) {
                    home.A_DATA.A2 = false
                    home.A_DATA.A2I = "";
                    /// save A3
                    home.A_DATA.A3 = false
                } else {
                    home.A_DATA.A2 = false
                    home.A_DATA.A2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.A_DATA.A2 = false
                home.A_DATA.A2I = "";
                /// save A3
                home.A_DATA.A3 = false
            } else {
                home.A_DATA.A2 = false
                home.A_DATA.A2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveA3 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_a3")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_a3")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_a3") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_a3") {
                if(check.area === 2) {
                    home.A_DATA.A3 = false
                    home.A_DATA.A3I = "";
                    // save A4
                    home.A_DATA.A4 = false
                } else {
                    home.A_DATA.A3 = false
                    home.A_DATA.A3I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.A_DATA.A3 = false
                home.A_DATA.A3I = "";
                // save A4
                home.A_DATA.A4 = false
            } else {
                home.A_DATA.A3 = false
                home.A_DATA.A3I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveA4 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_a4")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_a4")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_a4") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_a4") {
                home.A_DATA.A4 = false;
                home.A_DATA.A4I = "";
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            home.A_DATA.A4 = false;
            home.A_DATA.A4I = "";
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveB1 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_b1")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_b1")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_b1") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_b1") {
                if(check.area === 2) {
                    home.B_DATA.B2 = false
                    home.B_DATA.B2I = "";
                    /// save A3
                    home.B_DATA.B3 = false
                } else {
                    home.B_DATA.B2 = false
                    home.B_DATA.B2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.B_DATA.B2 = false
                home.B_DATA.B2I = "";
                /// save A3
                home.B_DATA.B3 = false
            } else {
                home.B_DATA.B2 = false
                home.B_DATA.B2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveB2 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_b2")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_b2")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_b2") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_b2") {
                if(check.area === 2) {
                    home.B_DATA.B2 = false
                    home.B_DATA.B2I = "";
                    /// save A3
                    home.B_DATA.B3 = false
                } else {
                    home.B_DATA.B2 = false
                    home.B_DATA.B2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.B_DATA.B2 = false
                home.B_DATA.B2I = "";
                /// save A3
                home.B_DATA.B3 = false
            } else {
                home.B_DATA.B2 = false
                home.B_DATA.B2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveB3 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_b3")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_b3")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_b3") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_b3") {
                if(check.area === 2) {
                    home.B_DATA.B3 = false
                    home.B_DATA.B3I = "";
                    // save A4
                    home.B_DATA.B4 = false
                } else {
                    home.B_DATA.B3 = false
                    home.B_DATA.B3I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.B_DATA.B3 = false
                home.B_DATA.B3I = "";
                // save A4
                home.B_DATA.B4 = false
            } else {
                home.B_DATA.B3 = false
                home.B_DATA.B3I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveB4 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_b4")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_b4")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_b4") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_b4") {
                home.B_DATA.B4 = false;
                home.B_DATA.B4I = "";
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            home.B_DATA.B4 = false;
            home.B_DATA.B4I = "";
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveC1 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_c1")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_c1")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_c1") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_c1") {
                if(check.area === 2) {
                    home.C_DATA.C2 = false
                    home.C_DATA.C2I = "";
                    /// save A3
                    home.C_DATA.C3 = false
                } else {
                    home.C_DATA.C2 = false
                    home.C_DATA.C2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.C_DATA.C2 = false
                home.C_DATA.C2I = "";
                /// save A3
                home.C_DATA.C3 = false
            } else {
                home.C_DATA.C2 = false
                home.C_DATA.C2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveC2 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_c2")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_c2")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_c2") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_c2") {
                if(check.area === 2) {
                    home.C_DATA.C2 = false
                    home.C_DATA.C2I = "";
                    /// save A3
                    home.C_DATA.C3 = false
                } else {
                    home.C_DATA.C2 = false
                    home.C_DATA.C2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.C_DATA.C2 = false
                home.C_DATA.C2I = "";
                /// save A3
                home.C_DATA.C3 = false
            } else {
                home.C_DATA.C2 = false
                home.C_DATA.C2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveC3 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_c3")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_c3")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_c3") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_c3") {
                if(check.area === 2) {
                    home.C_DATA.C3 = false
                    home.C_DATA.C3I = "";
                    // save A4
                    home.C_DATA.C4 = false
                } else {
                    home.C_DATA.C3 = false
                    home.C_DATA.C3I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.C_DATA.C3 = false
                home.C_DATA.C3I = "";
                // save A4
                home.C_DATA.C4 = false
            } else {
                home.C_DATA.C3 = false
                home.C_DATA.C3I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveC4 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_c4")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_c4")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_c4") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_c4") {
                home.C_DATA.C4 = false;
                home.C_DATA.C4I = "";
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            home.C_DATA.C4 = false;
            home.C_DATA.C4I = "";
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveD1 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_d1")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_d1")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_d1") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_d1") {
                if(check.area === 2) {
                    home.D_DATA.D1 = false
                    home.D_DATA.D1I = "";
                    /// save A3
                    home.D_DATA.D2 = false
                } else {
                    home.D_DATA.D1 = false
                    home.D_DATA.D1I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.D_DATA.D1 = false
                home.D_DATA.D1I = "";
                /// save A3
                home.D_DATA.D2 = false
            } else {
                home.D_DATA.D1 = false
                home.D_DATA.D1I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveD2 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_d2")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_d2")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_d2") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_d2") {
                if(check.area === 2) {
                    home.D_DATA.D2 = false
                    home.D_DATA.D2I = "";
                    /// save A3
                    home.D_DATA.D3 = false
                } else {
                    home.D_DATA.D2 = false
                    home.D_DATA.D2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.D_DATA.D2 = false
                home.D_DATA.D2I = "";
                /// save A3
                home.D_DATA.D3 = false
            } else {
                home.D_DATA.D2 = false
                home.D_DATA.D2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveD3 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_d3")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_d3")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_d3") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_d3") {
                if(check.area === 2) {
                    home.D_DATA.D3 = false
                    home.D_DATA.D3I = "";
                    // save A4
                    home.D_DATA.D4 = false
                } else {
                    home.D_DATA.D3 = false
                    home.D_DATA.D3I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.D_DATA.D3 = false
                home.D_DATA.D3I = "";
                // save A4
                home.D_DATA.D4 = false
            } else {
                home.D_DATA.D3 = false
                home.D_DATA.D3I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveD4 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_d4")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_d4")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_d4") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_d4") {
                home.D_DATA.D4 = false;
                home.D_DATA.D4I = "";
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            home.D_DATA.D4 = false;
            home.D_DATA.D4I = "";
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveL1 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_l1")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_l1")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_l1") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_l1") {
                if(check.area === 2) {
                    home.WALL_DATA.L2 = false
                    home.WALL_DATA.L2I = "";
                    /// save A3
                    home.WALL_DATA.L3 = false
                } else {
                    home.WALL_DATA.L2 = false
                    home.WALL_DATA.L2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.WALL_DATA.L2 = false
                home.WALL_DATA.L2I = "";
                /// save A3
                home.WALL_DATA.L3 = false
            } else {
                home.WALL_DATA.L2 = false
                home.WALL_DATA.L2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveL2 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_l2")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_l2")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_l2") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_l2") {
                if(check.area === 2) {
                    home.WALL_DATA.L2 = false
                    home.WALL_DATA.L2I = "";
                    /// save A3
                    home.WALL_DATA.L3 = false
                } else {
                    home.WALL_DATA.L2 = false
                    home.WALL_DATA.L2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.WALL_DATA.L2 = false
                home.WALL_DATA.L2I = "";
                /// save A3
                home.WALL_DATA.L3 = false
            } else {
                home.WALL_DATA.L2 = false
                home.WALL_DATA.L2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveL3 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_l3")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_l3")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_l3") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_l3") {
                if(check.area === 2) {
                    home.WALL_DATA.L3 = false
                    home.WALL_DATA.L3I = "";
                    // save A4
                    home.WALL_DATA.L4 = false
                } else {
                    home.WALL_DATA.L3 = false
                    home.WALL_DATA.L3I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.WALL_DATA.L3 = false
                home.WALL_DATA.L3I = "";
                // save A4
                home.WALL_DATA.L4 = false
            } else {
                home.WALL_DATA.L3 = false
                home.WALL_DATA.L3I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveL4 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_l4")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_l4")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_l4") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_l4") {
                home.WALL_DATA.L4 = false;
                home.WALL_DATA.L4I = "";
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            home.WALL_DATA.L4 = false;
            home.WALL_DATA.L4I = "";
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveR1 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_r1")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_r1")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_r1") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_r1") {
                if(check.area === 2) {
                    home.WALL_DATA.R2 = false
                    home.WALL_DATA.R2I = "";
                    /// save A3
                    home.WALL_DATA.R3 = false
                } else {
                    home.WALL_DATA.R2 = false
                    home.WALL_DATA.R2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.WALL_DATA.R2 = false
                home.WALL_DATA.R2I = "";
                /// save A3
                home.WALL_DATA.R3 = false
            } else {
                home.WALL_DATA.R2 = false
                home.WALL_DATA.R2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveR2 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_r2")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_r2")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_r2") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_r2") {
                if(check.area === 2) {
                    home.WALL_DATA.R2 = false
                    home.WALL_DATA.R2I = "";
                    /// save A3
                    home.WALL_DATA.R3 = false
                } else {
                    home.WALL_DATA.R2 = false
                    home.WALL_DATA.R2I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.WALL_DATA.R2 = false
                home.WALL_DATA.R2I = "";
                /// save A3
                home.WALL_DATA.R3 = false
            } else {
                home.WALL_DATA.R2 = false
                home.WALL_DATA.R2I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveR3 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_r3")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_r3")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_r3") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_r3") {
                if(check.area === 2) {
                    home.WALL_DATA.R3 = false
                    home.WALL_DATA.R3I = "";
                    // save A4
                    home.WALL_DATA.R4 = false
                } else {
                    home.WALL_DATA.R3 = false
                    home.WALL_DATA.R3I = "";
                }
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            if(check.area === 2) {
                home.WALL_DATA.R3 = false
                home.WALL_DATA.R3I = "";
                // save A4
                home.WALL_DATA.R4 = false
            } else {
                home.WALL_DATA.R3 = false
                home.WALL_DATA.R3I = "";
            }
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveR4 = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_r4")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_r4")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_r4") {
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                /// save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_r4") {
                home.WALL_DATA.R4 = false;
                home.WALL_DATA.R4I = "";
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            home.WALL_DATA.R4 = false;
            home.WALL_DATA.R4I = "";
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

const saveFLOOR = async function (interaction, id, msg, message, check, renderUrl) {
    if (!interaction && !interaction.channel) throw new Error('Channel is inaccessible.');

    const button = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId("save_floor")
            .setLabel("Save")
            
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("exit_floor")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger),
    )

    await msg.edit({ content: "Save or Exit?", components: [button] });

    let filter = (m) => m.user.id === interaction.user.id;
    let collector = await msg.createMessageComponentCollector({ filter, time: 300000 });

    const home = await GHouse.findOne({ guild: interaction.guild.id, user: interaction.user.id });
    const inv = await GInv.findOne({ guild: interaction.guild.id, user: interaction.user.id });

    collector.on('collect', async (menu) => {
        if(menu.isButton()) {
            await menu.deferUpdate();
            if(menu.customId === "save_floor") {
                /// remove item
                inv.item.splice(inv.item.findIndex(x => x.id === id), 1);
                inv.save();
                // save link
                home.house = getFinalUrl(message, renderUrl);
                home.save();


                msg.edit({ content: "House has saved.", files: [], components: [] })

                collector.stop();
            } else if (menu.customId === "exit_floor") {
                // place floor
                home.FLOOR_DATA.FLOOR = false;
                home.FLOOR_DATA.FLOORI = "";
                await home.save();

                msg.edit({ content: "Your cancel edit the house.", files: [], components: [] })

                collector.stop();
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if(reason === 'time') {
            home.FLOOR_DATA.FLOOR = false;
            home.FLOOR_DATA.FLOORI = "";
            await home.save();

            msg.edit({ content: "Time is out. Auto cancel edit.", files: [], components: [] })
        }
    });

    return;
};

module.exports = { saveFLOOR, saveA1, saveA2, saveA3, saveA4, saveB1, saveB2, saveB3, saveB4, saveC1, saveC2, saveC3, saveC4, saveD1, saveD2, saveD3, saveD4, saveL1, saveL2, saveL3, saveL4, saveR1, saveR2, saveR3, saveR4 };