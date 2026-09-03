import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { createHealthServer } from './health';
import { info, error } from './logger';
import { loadCommands } from './commands/command-loader';
import { runAutoMod } from './automod/automod';
import { recordJoin } from './anti/raid';
import { recordDestructiveAction } from './anti/nuke';
import db from './db';
import path from 'path';

// Validate env
const token = process.env.DISCORD_TOKEN;
const ownerId = process.env.OWNER_ID;
if (!token) {
  console.error('Missing DISCORD_TOKEN in env');
  process.exit(1);
}
if (!ownerId) {
  console.error('Missing OWNER_ID in env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

(client as any).context = { ownerId };

const commands = loadCommands(client);

client.once(Events.ClientReady, () => {
  info('Logged in as', client.user?.tag);
  info('Guild count:', client.guilds.cache.size);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    // run automod
    await runAutoMod(message);
    // prefix handling
    const guildId = message.guild?.id;
    const prefix = guildId ? db.prepare('SELECT prefix FROM guild_settings WHERE guild_id = ?').get(guildId)?.prefix || '!' : '!';
    if (!message.content.startsWith(prefix)) return;
    const [cmdName, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = (client as any).commands.get(cmdName);
    if (!cmd) return;
    // permissions checks
    if (cmd.ownerOnly && message.author.id !== ownerId) return message.reply('Owner only.');
    if (cmd.permissions && !message.member?.permissions.has(cmd.permissions)) return message.reply('Missing permissions.');
    await cmd.executePrefix(message, args);
  } catch (e) {
    error('Message handler error', (e as Error).message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    const cmd = (client as any).commands.get(interaction.commandName);
    if (!cmd || !cmd.executeSlash) return interaction.reply({ content: 'Command not implemented.', ephemeral: true });
    // permission checks
    if (cmd.ownerOnly && interaction.user.id !== ownerId) return interaction.reply({ content: 'Owner only.', ephemeral: true });
    await cmd.executeSlash(interaction);
  } catch (e) {
    error('Interaction handler error', (e as Error).message);
    if (interaction.replied || interaction.deferred) {
      interaction.followUp({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    } else {
      interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
});

client.on(Events.GuildMemberAdd, member => {
  try {
    recordJoin(member);
  } catch (e) {
    error('GuildMemberAdd error', (e as Error).message);
  }
});

client.on(Events.ChannelDelete, channel => {
  try {
    const g = channel.guild;
    if (g) recordDestructiveAction(g, 'CHANNEL_DELETE', channel?.id);
  } catch (e) {
    error('ChannelDelete handler error', (e as Error).message);
  }
});

process.on('unhandledRejection', err => {
  error('UnhandledRejection', err && (err as Error).message ? (err as Error).message : err);
});
process.on('uncaughtException', err => {
  error('UncaughtException', err && (err as Error).message ? (err as Error).message : err);
});

async function start() {
  // Start health server
  const server = createHealthServer(client);
  // Login bot
  await client.login(token);
  // Startup report
  info('Startup report:');
  info('DB path:', path.resolve(process.env.DB_PATH || './data/bot.sqlite'));
  info('HTTP server:', `http://0.0.0.0:${process.env.PORT || 3000}/health`);
  info('Discord logged in:', client.user?.tag || 'unknown');
  info('Guild count:', client.guilds.cache.size);

  // Graceful shutdown
  const shutdown = async () => {
    info('Shutting down...');
    try {
      server.close();
    } catch {}
    try {
      await client.destroy();
    } catch {}
    try {
      db.close();
    } catch {}
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
