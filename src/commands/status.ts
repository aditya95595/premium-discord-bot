import { ActivityType, type PresenceStatusData, SlashCommandBuilder } from 'discord.js';
import db from '../db';
import { getGuildSettings, setGuildSetting } from '../db/settings';
import { applyStatusSettings, clearStatusTimers } from '../services/status';

const GLOBAL_SCOPE = '__global__';
const types: Record<string, ActivityType> = {
  playing: ActivityType.Playing,
  watching: ActivityType.Watching,
  listening: ActivityType.Listening,
  streaming: ActivityType.Streaming,
  competing: ActivityType.Competing,
};
const presences = new Set(['online', 'idle', 'dnd', 'invisible']);
const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Configure bot presence')
  .addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices(
    { name: 'add', value: 'add' }, { name: 'remove-all', value: 'remove-all' },
    { name: 'rotation-on', value: 'rotation-on' }, { name: 'rotation-off', value: 'rotation-off' },
    { name: 'view', value: 'view' }, { name: 'set', value: 'set' },
  ))
  .addStringOption(o => o.setName('text').setDescription('Status text').setMaxLength(128))
  .addStringOption(o => o.setName('type').setDescription('Activity').addChoices(
    { name: 'playing', value: 'playing' }, { name: 'watching', value: 'watching' },
    { name: 'listening', value: 'listening' }, { name: 'streaming', value: 'streaming' },
    { name: 'competing', value: 'competing' },
  ))
  .addStringOption(o => o.setName('presence').setDescription('Online state').addChoices(
    { name: 'online', value: 'online' }, { name: 'idle', value: 'idle' },
    { name: 'dnd', value: 'dnd' }, { name: 'invisible', value: 'invisible' },
  ))
  .addIntegerOption(o => o.setName('interval').setDescription('Rotation seconds').setMinValue(15).setMaxValue(3600));

function ensure(source: any) {
  if (source.user?.id !== (process.env.OWNER_ID || '') && source.author?.id !== (process.env.OWNER_ID || '')) {
    throw new Error('Owner only.');
  }
}

async function run(source: any, action: string, text: string | null, type: string, presence: string | null, interval: number | null) {
  ensure(source);
  const client = source.client;
  const settings = getGuildSettings(GLOBAL_SCOPE);

  if (action === 'add') {
    if (!text?.trim()) throw new Error('Status text is required.');
    const value = text.trim();
    if (value.length > 128) throw new Error('Status text must be 128 characters or fewer.');
    const p = (db.prepare('SELECT COALESCE(MAX(position),-1)+1 AS p FROM statuses WHERE guild_id=?').get(GLOBAL_SCOPE) as any).p;
    db.prepare('INSERT INTO statuses(guild_id,text,type,position) VALUES(?,?,?,?)').run(GLOBAL_SCOPE, value, type.toUpperCase(), p);
    await applyStatusSettings(client);
    return 'Status added.';
  }
  if (action === 'remove-all') {
    db.prepare('DELETE FROM statuses WHERE guild_id=?').run(GLOBAL_SCOPE);
    setGuildSetting(GLOBAL_SCOPE, 'status_rotation_enabled', 0);
    clearStatusTimers();
    return 'All rotating statuses removed.';
  }
  if (action === 'rotation-on') {
    if (interval !== null) setGuildSetting(GLOBAL_SCOPE, 'status_rotation_interval', interval);
    setGuildSetting(GLOBAL_SCOPE, 'status_rotation_enabled', 1);
    await applyStatusSettings(client);
    return 'Status rotation enabled.';
  }
  if (action === 'rotation-off') {
    setGuildSetting(GLOBAL_SCOPE, 'status_rotation_enabled', 0);
    clearStatusTimers();
    return 'Status rotation disabled.';
  }
  if (action === 'set') {
    if (!text?.trim()) throw new Error('Status text is required.');
    const value = text.trim();
    if (value.length > 128) throw new Error('Status text must be 128 characters or fewer.');
    const state = presence || 'online';
    if (!presences.has(state)) throw new Error('Invalid presence state.');
    clearStatusTimers();
    client.user?.setPresence({ status: state as PresenceStatusData, activities: [{ name: value, type: types[type] ?? ActivityType.Playing }] });
    return 'Presence updated.';
  }

  const rows = db.prepare('SELECT text,type FROM statuses WHERE guild_id=? ORDER BY position,id').all(GLOBAL_SCOPE) as Array<{text:string;type:string}>;
  const lines = rows.length ? rows.map(row => `${row.type}: ${row.text}`).join('\n') : 'No rotating statuses configured.';
  return `${lines}\n\nRotation: ${settings.status_rotation_enabled ? 'ON' : 'OFF'}\nInterval: ${settings.status_rotation_interval}s`;
}

async function executeSlash(i: any) {
  try {
    return i.reply({ content: await run(i, i.options.getString('action', true), i.options.getString('text'), i.options.getString('type') || 'playing', i.options.getString('presence'), i.options.getInteger('interval')), ephemeral: true });
  } catch (e) {
    return i.reply({ content: e instanceof Error ? e.message : 'Invalid status request.', ephemeral: true });
  }
}

async function executePrefix(m: any, args: string[]) {
  try {
    const action = (args.shift() || 'view').toLowerCase();
    const text = args.join(' ').trim() || null;
    return m.reply(await run(m, action, text, 'playing', 'online', null));
  } catch (e) {
    return m.reply(e instanceof Error ? e.message : 'Invalid status request.');
  }
}

export default { name: 'status', description: 'Configure bot presence', ownerOnly: true, cooldown: 2, data, executeSlash, executePrefix };
