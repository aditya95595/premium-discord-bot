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
const seen = new Set<string>();
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
  console.error(`Compiled command directory not found: ${commandsPath}`);
  process.exit(1);
}

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') && f !== 'command-loader.js').sort()) {
  try {
    const mod = require(path.join(commandsPath, file));
    const command = mod.default || mod;
    if (!command?.data?.toJSON) continue;
    const json = command.data.toJSON();
    const name = String(json.name || '').toLowerCase();
    if (!name || seen.has(name)) {
      if (seen.has(name)) throw new Error(`Duplicate slash command "${name}" found while registering ${file}.`);
      throw new Error(`Invalid slash command in ${file}.`);
    }
    seen.add(name);
    commands.push(json);
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
    console.log(`Preparing ${commands.length} unique slash commands...`);

    if (guildId) {
      // A previous global deployment can otherwise appear alongside guild commands.
      // Clear the global command set, then atomically bulk-overwrite the development guild set.
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`Registered ${commands.length} slash commands to guild ${guildId}; global command set cleared.`);
    } else {
      // Bulk overwrite is idempotent: removed commands disappear instead of accumulating duplicates.
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`Registered ${commands.length} global slash commands. Discord may take time to propagate global updates.`);
    }
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
