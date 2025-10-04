module.exports = async(client, message) => {
    if (!message.guild) return;
    if (message.author.bot) return;

    await client.createHome(message.guild.id, message.author.id);
    await client.createProfile(message.guild.id, message.author.id);
    await client.createInv(message.guild.id, message.author.id);

}