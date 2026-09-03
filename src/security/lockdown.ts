import { ChannelType, Guild, PermissionFlagsBits } from 'discord.js';
import db from '../db';
import { info, warn } from '../logger';

const LOCKDOWN_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildMedia]);

type OverwriteSnapshot = { allow: string; deny: string };

function snapshotEveryone(channel: any): OverwriteSnapshot {
  const overwrite = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
  return { allow: (overwrite?.allow?.bitfield ?? 0n).toString(), deny: (overwrite?.deny?.bitfield ?? 0n).toString() };
}

function restorePayload(snapshot: OverwriteSnapshot) {
  return {
    SendMessages: null,
    AddReactions: null,
    CreatePublicThreads: null,
    CreatePrivateThreads: null,
    SendMessagesInThreads: null,
  };
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
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        SendMessagesInThreads: false,
      }, { reason });
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
  for (const row of rows) {
    const channel: any = guild.channels.cache.get(row.channel_id);
    if (!channel || !('permissionOverwrites' in channel) || !channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) { skipped++; continue; }
    try {
      const current = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      const originalAllow = BigInt(row.allow), originalDeny = BigInt(row.deny);
      const currentAllow = current?.allow?.bitfield ?? 0n;
      const currentDeny = current?.deny?.bitfield ?? 0n;
      const changedByOtherActor = current && (currentAllow !== originalAllow || currentDeny !== originalDeny) &&
        ((currentDeny & BigInt(PermissionFlagsBits.SendMessages)) === 0n || (originalDeny & BigInt(PermissionFlagsBits.SendMessages)) !== 0n);
      if (changedByOtherActor) {
        skipped++;
        continue;
      }
      await channel.permissionOverwrites.edit(guild.roles.everyone, restorePayload({ allow: row.allow, deny: row.deny }), { reason });
      restored++;
    } catch (e) {
      skipped++;
      warn('Lockdown restore failed', row.channel_id, e instanceof Error ? e.message : String(e));
    }
  }
  db.prepare('DELETE FROM lockdown_overwrites WHERE guild_id=?').run(guild.id);
  db.prepare('UPDATE guild_settings SET raid_mode=0 WHERE guild_id=?').run(guild.id);
  db.prepare('INSERT INTO audit_events(guild_id,action,target_id,timestamp) VALUES(?,?,?,?)').run(guild.id, 'security_unlock', guild.id, Date.now());
  info(`Lockdown disabled for ${guild.id}: ${restored} restored, ${skipped} skipped`);
  return { ok: true, restored, skipped };
}
