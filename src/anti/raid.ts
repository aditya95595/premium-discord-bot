import { GuildMember } from 'discord.js';
import { info, warn } from '../logger';
import db from '../db';
import { addInfraction } from '../db/infractions';

const JOIN_WINDOW_MS = 60_000;
const JOIN_THRESHOLD = 6; // configurable per guild in DB eventually

const recentJoins: Map<string, { ts: number; count: number }> = new Map();

export function recordJoin(member: GuildMember) {
  try {
    const guildId = member.guild.id;
    const now = Date.now();
    const entry = recentJoins.get(guildId);
    if (!entry || now - entry.ts > JOIN_WINDOW_MS) {
      recentJoins.set(guildId, { ts: now, count: 1 });
    } else {
      entry.count++;
      recentJoins.set(guildId, entry);
      if (entry.count >= JOIN_THRESHOLD) {
        triggerRaidMode(member.guildId);
      }
    }
  } catch (e) {
    warn('recordJoin error', (e as Error).message);
  }
}

function triggerRaidMode(guildId: string) {
  // minimal approach: write raid_mode flag to DB so bot will refuse new-member role assignment/auto actions
  info('Triggering raid mode for guild', guildId);
  const stmt = db.prepare('UPDATE guild_settings SET raid_mode = 1 WHERE guild_id = ?');
  stmt.run(guildId);
  // Insert an audit event
  db.prepare('INSERT INTO audit_events (guild_id, action, timestamp) VALUES (?, ?, ?)').run(guildId, 'raid_trigger', Date.now());
}
