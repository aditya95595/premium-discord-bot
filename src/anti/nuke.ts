import { Guild, GuildAuditLogsEntry } from 'discord.js';
import db from '../db';
import { info, warn } from '../logger';

// Detect multiple destructive events from same executor in short time
const WINDOW_MS = 60_000;
const THRESHOLD = 3;

const recent: Map<string, Array<{ executor: string; ts: number }>> = new Map();

export async function recordDestructiveAction(guild: Guild, action: string, targetId?: string) {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 5, type: 'CHANNEL_DELETE' as any }).catch(() => null);
    let executorId: string | undefined;
    if (logs && logs.entries.size) {
      const entry = logs.entries.first() as GuildAuditLogsEntry | undefined;
      executorId = entry?.executor?.id;
    }
    if (!executorId) return;
    const arr = recent.get(guild.id) || [];
    const now = Date.now();
    const windowed = arr.filter(a => now - a.ts <= WINDOW_MS);
    windowed.push({ executor: executorId, ts: now });
    recent.set(guild.id, windowed);
    const count = windowed.filter(x => x.executor === executorId).length;
    db.prepare('INSERT INTO audit_events (guild_id, action, target_id, executor_id, timestamp) VALUES (?, ?, ?, ?, ?)').run(guild.id, action, targetId ?? null, executorId, now);
    if (count >= THRESHOLD) {
      info('Nuke detected, executor:', executorId, 'guild:', guild.id);
      // Attempt to ban executor after validation
      const member = guild.members.cache.get(executorId) || await guild.members.fetch(executorId).catch(() => null);
      if (member && guild.members.me?.permissions.has('BanMembers')) {
        await member.ban({ reason: 'Anti-nuke: mass destructive actions detected' }).catch(e => warn('Failed to ban suspected nuker', e));
        db.prepare('INSERT INTO audit_events (guild_id, action, target_id, executor_id, timestamp) VALUES (?, ?, ?, ?, ?)').run(guild.id, 'anti_nuke_ban', executorId, executorId, Date.now());
      }
    }
  } catch (e) {
    warn('recordDestructiveAction error', (e as Error).message);
  }
}
