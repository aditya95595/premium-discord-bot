import { Client } from 'discord.js';
import { loadCommands } from './commands/command-loader';

const client = new Client({ intents: [] });

try {
  const commands = loadCommands(client);
  const names = [...commands.keys()].sort();
  console.log(`Command registry validation passed: ${names.length} unique commands.`);
  console.log(names.join(', '));
} finally {
  // This validator never connects to Discord, so the websocket manager is
  // intentionally left untouched. Calling client.destroy() before login
  // crashes in discord.js because its websocket has not been initialized.
}
