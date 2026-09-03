import db from './index';

export type GuildSettingsRow = {
  guild_id: string; prefix: string; automod_enabled: number; automod_profanity: number; automod_caps: number;
  automod_links: number; automod_spam_threshold: number; automod_mention_limit: number; automod_invites: number;
  automod_blocked_words: string; automod_punishment: string; mod_log_channel: string | null; staff_roles: string;
  raid_mode: number; raid_threshold: number; raid_window_seconds: number; status_rotation_enabled: number; status_rotation_interval: number;
};
export function getGuildSettings(guildId: string): GuildSettingsRow {
  let row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId) as GuildSettingsRow | undefined;
  if (!row) { db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId); row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId) as GuildSettingsRow; }
  return row;
}
const allowed = new Set<keyof GuildSettingsRow>(['prefix','automod_enabled','automod_profanity','automod_caps','automod_links','automod_spam_threshold','automod_mention_limit','automod_invites','automod_blocked_words','automod_punishment','mod_log_channel','staff_roles','raid_mode','raid_threshold','raid_window_seconds','status_rotation_enabled','status_rotation_interval']);
export function setGuildSetting<T extends keyof GuildSettingsRow>(guildId: string, key: T, value: GuildSettingsRow[T]) {
  if (!allowed.has(key)) throw new Error('Invalid setting');
  db.prepare(`UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`).run(value as unknown, guildId);
}
