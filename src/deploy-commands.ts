import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('Need DISCORD_TOKEN and DISCORD_CLIENT_ID in env');
  process.exit(1);
}

const commands: any[] = [];
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
  console.error(`Compiled command directory not found: ${commandsPath}`);
  process.exit(1);
}

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  if (file === 'command-loader.js') continue;
  try {
    const mod = require(path.join(commandsPath, file));
    const command = mod.default || mod;
    if (command?.data?.toJSON) commands.push(command.data.toJSON());
  } catch (error) {
    console.error(`Failed to load command ${file}:`, error);
    process.exit(1);
  }
}

if (!commands.length) {
  console.error('No slash commands were found to register.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash commands...`);
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`Registered commands to guild ${guildId}.`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Registered global commands. Discord may take time to propagate global updates.');
    }
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
