import fs from 'fs';
import path from 'path';
import { Collection } from 'discord.js';
import type { Client } from 'discord.js';

export type Command = {
  name: string;
  description: string;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  permissions?: string[]; // Discord permissions names
  executeSlash?: (interaction: any) => Promise<any>;
  executePrefix?: (message: any, args: string[]) => Promise<any>;
  data?: any; // Slash command builder
};

export function loadCommands(client: Client) {
  const commands = new Collection<string, Command>();
  const commandsPath = path.join(__dirname);
  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  for (const file of files) {
    if (file === 'command-loader.ts') continue;
    const full = path.join(commandsPath, file);
    try {
      const mod = require(full);
      if (mod && mod.default && mod.default.name) {
        commands.set(mod.default.name, mod.default);
      } else if (mod && mod.name) {
        commands.set(mod.name, mod);
      }
    } catch (err) {
      console.error('Failed to load command', file, err);
    }
  }
  // attach to client for convenience
  (client as any).commands = commands;
  return commands;
}
