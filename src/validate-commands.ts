import { Client } from 'discord.js';
import { loadCommands } from './commands/command-loader';

const client = new Client({ intents: [] });
try {
  const commands = loadCommands(client);
  const names = [...commands.keys()].sort();
  console.log(`Command registry validation passed: ${names.length} unique commands.`);
  console.log(names.join(', '));
} finally {
  client.destroy();
}
