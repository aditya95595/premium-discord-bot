import { Guild } from 'discord.js';
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

export async function safeExecute<T>(cb: () => Promise<T> | T): Promise<T> {
  try {
    return await cb();
  } catch (err: any) {
    error('safeExecute error:', err && err.message ? err.message : err);
    return null as unknown as T;
  }
}
