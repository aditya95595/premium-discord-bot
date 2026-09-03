import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('Need DISCORD_TOKEN and CLIENT_ID in env');
  process.exit(1);
}

const commands: any[] = [];
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  for (const file of files) {
    if (file === 'command-loader.ts') continue;
    const mod = require(path.join(commandsPath, file));
    const c = mod.default || mod;
    if (c && c.data) {
      commands.push(c.data.toJSON());
    }
  }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registering commands...');
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log('Registered commands to guild', guildId);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Registered global commands (may take up to 1 hour).');
    }
  } catch (e) {
    console.error('Failed to register commands', e);
  }
})();
