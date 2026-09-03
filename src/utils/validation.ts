import { Guild, GuildMember, Role } from 'discord.js';
import { error } from '../logger';

export function ensureGuildHasMember(guild: Guild, userId: string) {
  const member = guild.members.cache.get(userId) || null;
  return member;
}

export function ensureRoleInGuild(guild: Guild, roleId: string) {
  return guild.roles.cache.get(roleId) || null;
}

export function isIdLike(id: string) {
  return typeof id === 'string' && /^\d{17,}$/.test(id);
}

export function safeExecute<T>(cb: () => Promise<T> | T) {
  return cb().catch((err) => {
    error('safeExecute error:', err && err.message ? err.message : err);
    return null as unknown as T;
  });
}
