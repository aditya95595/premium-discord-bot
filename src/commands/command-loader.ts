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

/**
 * Loads the single canonical command registry used by both prefix and slash execution.
 * Duplicate command names are a startup error instead of being silently overwritten.
 */
export function loadCommands(client: Client) {
  const commands = new Collection<string, Command>();
  const commandsPath = path.join(__dirname);
  if (!fs.existsSync(commandsPath)) throw new Error(`Command directory not found: ${commandsPath}`);

  const files = fs.readdirSync(commandsPath)
    .filter(f => f.endsWith('.js') && f !== 'command-loader.js')
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const mod = require(path.join(commandsPath, file));
    const command = mod?.default ?? mod;
    if (!command?.name) continue;

    const name = String(command.name).trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(name)) throw new Error(`Invalid command name in ${file}: ${command.name}`);
    if (!command.data?.toJSON) throw new Error(`Command ${name} in ${file} is missing slash command data.`);
    if (typeof command.executeSlash !== 'function') throw new Error(`Command ${name} in ${file} is missing executeSlash.`);
    if (typeof command.executePrefix !== 'function') throw new Error(`Command ${name} in ${file} is missing executePrefix.`);
    if (commands.has(name)) throw new Error(`Duplicate command name "${name}" detected while loading ${file}.`);

    const slashName = String(command.data.toJSON().name ?? '').toLowerCase();
    if (slashName !== name) throw new Error(`Command ${name} in ${file} has mismatched slash name "${slashName}".`);
    commands.set(name, { ...command, name });
  }

  if (!commands.size) throw new Error('No commands were loaded.');
  (client as any).commands = commands;
  return commands;
}
