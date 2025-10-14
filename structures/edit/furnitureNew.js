const { editFurnitureUnified } = require('./furnitureUnified.js');

// Wrapper functions to maintain compatibility
const editFurnitureA = async (client, interaction, msg, item, type, id) => {
    return editFurnitureUnified(client, interaction, msg, item, type, id, 'A');
};

const editFurnitureB = async (client, interaction, msg, item, type, id) => {
    return editFurnitureUnified(client, interaction, msg, item, type, id, 'B');
};

const editFurnitureC = async (client, interaction, msg, item, type, id) => {
    return editFurnitureUnified(client, interaction, msg, item, type, id, 'C');
};

const editFurnitureD = async (client, interaction, msg, item, type, id) => {
    return editFurnitureUnified(client, interaction, msg, item, type, id, 'D');
};

module.exports = { editFurnitureA, editFurnitureB, editFurnitureC, editFurnitureD };
