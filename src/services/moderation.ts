import type { Guild, GuildMember } from 'discord.js';
import db from '../db';
import { addInfraction } from '../db/infractions';

export type ModerationResult = { ok: true; caseId: number } | { ok: false; reason: string };

export function targetGuard(actor: GuildMember, target: GuildMember | null, bot: GuildMember | null): string | null {
  if (!target) return 'That member is not in this server.';
  if (target.id === actor.id) return 'You cannot target yourself.';
  if (target.id === actor.guild.ownerId) return 'You cannot target the server owner.';
  if (target.id === bot?.id) return 'I cannot target myself.';
  if (actor.id !== actor.guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) return 'Your highest role must be above the target.';
  if (bot && target.roles.highest.position >= bot.roles.highest.position) return 'My highest role must be above the target.';
  return null;
}

export function createCase(guild: Guild, userId: string, moderatorId: string, type: string, reason: string, expiresAt?: number): number {
  return addInfraction(guild.id, userId, moderatorId, type, reason, expiresAt) || 0;
}

export function activeTemporaryCases(guildId: string) {
  return db.prepare('SELECT * FROM infractions WHERE guild_id=? AND expires_at IS NOT NULL AND expires_at>? ORDER BY expires_at').all(guildId, Date.now());
}
