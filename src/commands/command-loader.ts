import fs from 'fs';
import path from 'path';
import { Collection } from 'discord.js';
import type { Client } from 'discord.js';

export type Command = {
  name: string;
  description: string;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  sensitive?: boolean;
  permissions?: string[];
  cooldown?: number;
  executeSlash?: (interaction: any) => Promise<any>;
  executePrefix?: (message: any, args: string[]) => Promise<any>;
  data?: any;
};

export function loadCommands(client: Client) {
  const commands = new Collection<string, Command>();
  const commandsPath = path.join(__dirname);
  const files = fs.readdirSync(commandsPath).filter(f => (f.endsWith('.js') || f.endsWith('.ts')) && f !== 'command-loader.ts' && f !== 'command-loader.js');
  for (const file of files) {
    try {
      const mod = require(path.join(commandsPath, file));
      const command = mod?.default ?? mod;
      if (command?.name) commands.set(command.name.toLowerCase(), command);
    } catch (err) {
      console.error(`Failed to load command ${file}:`, err);
    }
  }
  (client as any).commands = commands;
  return commands;
}
