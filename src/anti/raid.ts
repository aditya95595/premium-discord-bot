import { GuildMember } from 'discord.js';
import { info, warn } from '../logger';
import db from '../db';
import { getGuildSettings } from '../db/settings';
import { enableLockdown } from '../security/lockdown';

const recentJoins = new Map<string, { ts: number; count: number }>();
const triggered = new Map<string, number>();

export function recordJoin(member: GuildMember) {
  void handleJoin(member);
}

async function handleJoin(member: GuildMember) {
  try {
    const guild = member.guild;
    const settings = getGuildSettings(guild.id);
    const now = Date.now();
    const windowMs = Math.max(10, settings.raid_window_seconds) * 1000;
    const old = recentJoins.get(guild.id);
    const entry = !old || now - old.ts > windowMs ? { ts: now, count: 1 } : { ts: old.ts, count: old.count + 1 };
    recentJoins.set(guild.id, entry);
    if (entry.count < Math.max(3, settings.raid_threshold)) return;

    const lastTrigger = triggered.get(guild.id) ?? 0;
    if (now - lastTrigger < windowMs) return;
    triggered.set(guild.id, now);

    db.prepare('UPDATE guild_settings SET raid_mode=1 WHERE guild_id=?').run(guild.id);
    db.prepare('INSERT INTO audit_events(guild_id,action,target_id,timestamp) VALUES(?,?,?,?)')
      .run(guild.id, 'raid_trigger', member.id, now);
    info(`Raid protection triggered for guild ${guild.id}: ${entry.count} joins`);

    // Respect the configured security response. Alert-only stays passive; lockdown modes
    // immediately protect supported text channels without attempting destructive actions.
    if (settings.security_enabled && settings.security_action !== 'alert') {
      const result = await enableLockdown(guild, `Automatic raid protection: ${entry.count} joins in ${settings.raid_window_seconds}s`);
      if (!result.ok) warn(`Raid lockdown failed for guild ${guild.id}: ${result.reason}`);
    }
  } catch (e) {
    warn('recordJoin error', e instanceof Error ? e.message : String(e));
  }
}

setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [key, value] of recentJoins) if (value.ts < cutoff) recentJoins.delete(key);
  for (const [key, value] of triggered) if (value < cutoff) triggered.delete(key);
}, 60_000).unref();
