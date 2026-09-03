import type { Client } from 'discord.js';

export interface BotContext {
  client: Client;
  ownerId: string;
}
