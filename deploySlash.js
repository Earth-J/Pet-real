const { plsParseArgs } = require('plsargs');
const args = plsParseArgs(process.argv.slice(2));
const chillout = require("chillout");
const { makeSureFolderExists } = require("stuffs");
const path = require("path");
const readdirRecursive = require("recursive-readdir");
const { TOKEN } = require("./settings/config.js");
const { ApplicationCommandOptionType, REST, Routes, ApplicationCommandManager } = require('discord.js');

(async () => {

  let command = [];

  let cleared = args.get(0) == "guild" ? args.get(2) == "clear" : (args.get(0) == "global" ? args.get(1) == "clear" : false);
  let deployed = args.get(0) == "guild" ? "guild" : args.get(0) == "global" ? "global" : null;

  if (!deployed) {
    console.error(`Invalid sharing mode! Valid modes: guild, global`);
    console.error(`Usage example: node deploySlash.js guild <guildId> [clear]`);
    console.error(`Usage example: node deploySlash.js global [clear]`);
    return process.exit(1);
  }

  if (!cleared) {
    let interactionsFolder = path.resolve("./commands");

    await makeSureFolderExists(interactionsFolder);

    let store = [];

    console.log("Reading interaction files..")

    let interactionFilePaths = await readdirRecursive(interactionsFolder);
    interactionFilePaths = interactionFilePaths.filter(i => {
      let state = path.basename(i).startsWith("-");
      return !state;
    });

    await chillout.forEach(interactionFilePaths, (interactionFilePath) => {
      const cmd = require(interactionFilePath);
      
      // แปลง name เป็น array หากเป็น string
      if (typeof cmd.name === 'string') {
        cmd.name = [cmd.name];
      }
      
      // ตรวจสอบว่า cmd.name เป็น array และมีข้อมูล
      if (Array.isArray(cmd.name) && cmd.name.length > 0) {
        console.log(`Interaction "${cmd.type == "CHAT_INPUT" ? `/${cmd.name.join(" ")}` : `${cmd.name[0]}`}" ${cmd.name[1] || ""} ${cmd.name[2] || ""} added to the transform list!`);
        store.push(cmd);
      } else if (typeof cmd.name === 'string' && cmd.name.trim() !== '') {
        console.log(`Interaction "${cmd.name}" added to the transform list!`);
        store.push(cmd);
      } else {
        console.log(`Skipping interaction with invalid name: ${JSON.stringify(cmd.name)}`);
      }
    });

    store = store.sort((a, b) => {
      const aLength = Array.isArray(a.name) ? a.name.length : 1;
      const bLength = Array.isArray(b.name) ? b.name.length : 1;
      return aLength - bLength;
    })

    command = store.reduce((all, current) => {
      const nameLength = Array.isArray(current.name) ? current.name.length : 1;
      
      switch (nameLength) {
        case 1: {
          all.push({
            type: current.type,
            name: Array.isArray(current.name) ? current.name[0] : current.name,
            description: current.description,
            defaultPermission: current.defaultPermission,
            options: current.options
          });
          break;
        }
        case 2: {
          let baseItem = all.find((i) => {
            return i.name == (Array.isArray(current.name) ? current.name[0] : current.name) && i.type == current.type
          });
          if (!baseItem) {
            all.push({
              type: current.type,
              name: Array.isArray(current.name) ? current.name[0] : current.name,
              description: `${Array.isArray(current.name) ? current.name[0] : current.name} commands.`,
              defaultPermission: current.defaultPermission,
              options: [
                {
                  type: ApplicationCommandOptionType.Subcommand,
                  description: current.description,
                  name: Array.isArray(current.name) ? current.name[1] : current.name,
                  options: current.options
                }
              ]
            });
          } else {
            baseItem.options.push({
              type: ApplicationCommandOptionType.Subcommand,
              description: current.description,
              name: Array.isArray(current.name) ? current.name[1] : current.name,
              options: current.options
            })
          }
          break;
        }
        case 3: {
          let SubItem = all.find((i) => {
            return i.name == (Array.isArray(current.name) ? current.name[0] : current.name) && i.type == current.type
          });
          if (!SubItem) {
            all.push({
              type: current.type,
              name: current.name[0],
              description: `${current.name[0]} commands.`,
              defaultPermission: current.defaultPermission,
              options: [
                {
                  type: ApplicationCommandOptionType.SubcommandGroup,
                  description: `${current.name[1]} commands.`,
                  name: current.name[1],
                  options: [
                    {
                      type: ApplicationCommandOptionType.Subcommand,
                      description: current.description,
                      name: current.name[2],
                      options: current.options
                    }
                  ]
                }
              ]
            });
          } else {
            let GroupItem = SubItem.options.find(i => {
              return i.name == current.name[1] && i.type == ApplicationCommandOptionType.SubcommandGroup
            });
            if (!GroupItem) {
              SubItem.options.push({
                type: ApplicationCommandOptionType.SubcommandGroup,
                description: `${current.name[1]} commands.`,
                name: current.name[1],
                options: [
                  {
                    type: ApplicationCommandOptionType.Subcommand,
                    description: current.description,
                    name: current.name[2],
                    options: current.options
                  }
                ]
              })
            } else {
              GroupItem.options.push({
                type: ApplicationCommandOptionType.Subcommand,
                description: current.description,
                name: current.name[2],
                options: current.options
              })
            }
          }
        }
          break;
      }

      return all;
    }, []);
    
    command = command.map(i => ApplicationCommandManager.transformCommand(i));
  } else {
    console.info("No interactions read, all existing ones will be cleared...");
  }

  const rest = new REST({ version: "9" }).setToken(TOKEN);
  const client = await rest.get(Routes.user());
  console.info(`Account information received! ${client.username}#${client.discriminator} (${client.id})`);

  console.info(`Interactions are posted on discord!`);
  switch (deployed) {
    case "guild": {
      let guildId = args.get(1);
      console.info(`Deploy mode: guild (${guildId})`);

      await rest.put(Routes.applicationGuildCommands(client.id, guildId), { body: command });

      console.info(`Shared commands may take 3-5 seconds to arrive.`);
      break;
    }
    case "global": {
      console.info(`Deploy mode: global`);

      await rest.put(Routes.applicationCommands(client.id), { body: command });

      console.info(`Shared commands can take up to 1 hour to arrive. If you want it to come immediately, you can throw your bot from your server and get it back.`);
      break;
    }
  }

  console.info(`Interactions shared!`);
  
  // Exit the process to prevent hanging
  process.exit(0);
})().catch((error) => {
  console.error('Error during deployment:', error);
  process.exit(1);
});

/// Credit https://github.com/akanora/Youtube-Together (Handler) || Edit by: https://github.com/Adivise