import { ChannelType, Guild, PermissionFlagsBits } from 'discord.js';
import db from '../db';
import { info, warn } from '../logger';

const LOCKDOWN_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildMedia]);
type OverwriteSnapshot = { allow: string; deny: string };
const LOCKDOWN_PERMISSIONS = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads, PermissionFlagsBits.SendMessagesInThreads] as const;
const PERMISSION_NAMES: Record<string, string> = {
  [PermissionFlagsBits.SendMessages.toString()]: 'SendMessages',
  [PermissionFlagsBits.AddReactions.toString()]: 'AddReactions',
  [PermissionFlagsBits.CreatePublicThreads.toString()]: 'CreatePublicThreads',
  [PermissionFlagsBits.CreatePrivateThreads.toString()]: 'CreatePrivateThreads',
  [PermissionFlagsBits.SendMessagesInThreads.toString()]: 'SendMessagesInThreads',
};

function snapshotEveryone(channel: any): OverwriteSnapshot {
  const overwrite = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
  return { allow: (overwrite?.allow?.bitfield ?? 0n).toString(), deny: (overwrite?.deny?.bitfield ?? 0n).toString() };
}

function originalState(snapshot: OverwriteSnapshot, permission: bigint): true | false | null {
  const allow = BigInt(snapshot.allow), deny = BigInt(snapshot.deny);
  if ((allow & permission) !== 0n) return true;
  if ((deny & permission) !== 0n) return false;
  return null;
}

function restorePayload(snapshot: OverwriteSnapshot) {
  return Object.fromEntries(LOCKDOWN_PERMISSIONS.map(permission => [PERMISSION_NAMES[permission.toString()], originalState(snapshot, permission)]));
}

function lockdownStateMatches(current: any): boolean {
  const allow = current?.allow?.bitfield ?? 0n;
  const deny = current?.deny?.bitfield ?? 0n;
  const bits = LOCKDOWN_PERMISSIONS.reduce((value, permission) => value | permission, 0n);
  return (allow & bits) === 0n && (deny & bits) === bits;
}

export async function enableLockdown(guild: Guild, reason = 'Security lockdown') {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return { ok: false, changed: 0, skipped: 0, reason: 'I need Manage Channels permission.' };
  let changed = 0, skipped = 0;
  const existing = db.prepare('SELECT channel_id FROM lockdown_overwrites WHERE guild_id=?').all(guild.id) as Array<{ channel_id: string }>;
  const existingIds = new Set(existing.map(x => x.channel_id));
  for (const channel of guild.channels.cache.values()) {
    if (!LOCKDOWN_TYPES.has(channel.type) || !('permissionOverwrites' in channel)) { skipped++; continue; }
    if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) { skipped++; continue; }
    try {
      if (!existingIds.has(channel.id)) {
        const snap = snapshotEveryone(channel);
        db.prepare('INSERT OR IGNORE INTO lockdown_overwrites(guild_id,channel_id,allow,deny) VALUES(?,?,?,?)').run(guild.id, channel.id, snap.allow, snap.deny);
      }
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false, AddReactions: false, CreatePublicThreads: false, CreatePrivateThreads: false, SendMessagesInThreads: false }, { reason });
      changed++;
    } catch (e) {
      skipped++;
      warn('Lockdown channel update failed', channel.id, e instanceof Error ? e.message : String(e));
    }
  }
  db.prepare('UPDATE guild_settings SET raid_mode=1 WHERE guild_id=?').run(guild.id);
  db.prepare('INSERT INTO audit_events(guild_id,action,target_id,timestamp) VALUES(?,?,?,?)').run(guild.id, 'security_lockdown', guild.id, Date.now());
  info(`Lockdown enabled for ${guild.id}: ${changed} channels changed, ${skipped} skipped`);
  return { ok: true, changed, skipped };
}

export async function disableLockdown(guild: Guild, reason = 'Security lockdown lifted') {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return { ok: false, restored: 0, skipped: 0, reason: 'I need Manage Channels permission.' };
  const rows = db.prepare('SELECT * FROM lockdown_overwrites WHERE guild_id=?').all(guild.id) as Array<{ channel_id: string; allow: string; deny: string }>;
  let restored = 0, skipped = 0;
  const removable: string[] = [];
  for (const row of rows) {
    const channel: any = guild.channels.cache.get(row.channel_id);
    if (!channel) {
      removable.push(row.channel_id);
      continue;
    }
    if (!('permissionOverwrites' in channel) || !channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) { skipped++; continue; }
    try {
      const current = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      if (!current || !lockdownStateMatches(current)) { skipped++; continue; }
      const originalAllow = BigInt(row.allow), originalDeny = BigInt(row.deny);
      const lockdownBits = LOCKDOWN_PERMISSIONS.reduce((bits, permission) => bits | permission, 0n);
      const nonLockdownChanged = ((current.allow.bitfield ^ originalAllow) | (current.deny.bitfield ^ originalDeny)) & ~lockdownBits;
      if (nonLockdownChanged !== 0n) { skipped++; continue; }
      await channel.permissionOverwrites.edit(guild.roles.everyone, restorePayload({ allow: row.allow, deny: row.deny }), { reason });
      removable.push(row.channel_id);
      restored++;
    } catch (e) {
      skipped++;
      warn('Lockdown restore failed', row.channel_id, e instanceof Error ? e.message : String(e));
    }
  }
  const removeStmt = db.prepare('DELETE FROM lockdown_overwrites WHERE guild_id=? AND channel_id=?');
  const transaction = db.transaction((ids: string[]) => { for (const id of ids) removeStmt.run(guild.id, id); });
  transaction(removable);
  const remaining = db.prepare('SELECT COUNT(*) AS count FROM lockdown_overwrites WHERE guild_id=?').get(guild.id) as { count: number };
  if (remaining.count === 0) db.prepare('UPDATE guild_settings SET raid_mode=0 WHERE guild_id=?').run(guild.id);
  db.prepare('INSERT INTO audit_events(guild_id,action,target_id,timestamp) VALUES(?,?,?,?)').run(guild.id, 'security_unlock', guild.id, Date.now());
  info(`Lockdown disabled for ${guild.id}: ${restored} restored, ${skipped} skipped, ${remaining.count} pending`);
  return { ok: true, restored, skipped, pending: remaining.count };
}
