const { EmbedBuilder } = require("discord.js");

/**
 * Safely edit a message with fallback handling for Discord API error 10008 (Unknown Message)
 * @param {Object} msg - The message object to edit
 * @param {Object} interaction - The interaction object for fallback
 * @param {Object} options - The edit options (content, embeds, components, files)
 * @returns {Promise<Object>} - The message object (original or new)
 */
async function safeEditMessage(msg, interaction, options) {
    try {
        return await msg.edit(options);
    } catch (error) {
        if (error.code === 10008) {
            // Message no longer exists, try to send a new one
            console.log("Message no longer exists, sending new message as fallback");
            const newMsg = await interaction.followUp(options);
            return newMsg;
        } else {
            throw error;
        }
    }
}

/**
 * Safely edit a message with ephemeral fallback for Discord API error 10008 (Unknown Message)
 * @param {Object} msg - The message object to edit
 * @param {Object} interaction - The interaction object for fallback
 * @param {Object} options - The edit options (content, embeds, components, files)
 * @param {boolean} ephemeral - Whether to send fallback as ephemeral
 * @returns {Promise<Object>} - The message object (original or new)
 */
async function safeEditMessageWithEphemeral(msg, interaction, options, ephemeral = true) {
    try {
        return await msg.edit(options);
    } catch (error) {
        if (error.code === 10008) {
            // Message no longer exists, try to send a new one
            console.log("Message no longer exists, sending ephemeral fallback");
            const fallbackOptions = { ...options };
            if (ephemeral) {
                fallbackOptions.flags = 64; // MessageFlags.Ephemeral
            }
            const newMsg = await interaction.followUp(fallbackOptions);
            return newMsg;
        } else {
            throw error;
        }
    }
}

/**
 * Safely edit a message and ignore 10008 errors (useful for timeout handlers)
 * @param {Object} msg - The message object to edit
 * @param {Object} options - The edit options (content, embeds, components, files)
 * @returns {Promise<boolean>} - True if successful, false if message no longer exists
 */
async function safeEditMessageIgnore404(msg, options) {
    try {
        await msg.edit(options);
        return true;
    } catch (error) {
        if (error.code === 10008) {
            console.log("Message no longer exists during timeout, ignoring");
            return false;
        } else {
            throw error;
        }
    }
}

module.exports = {
    safeEditMessage,
    safeEditMessageWithEphemeral,
    safeEditMessageIgnore404
};


