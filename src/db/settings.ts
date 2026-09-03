import db from './index';

export type GuildSettingsRow = {
  guild_id: string;
  prefix: string;
  automod_enabled: number;
  automod_profanity: number;
  automod_caps: number;
  automod_links: number;
  automod_spam_threshold: number;
  mod_log_channel?: string | null;
  raid_mode: number;
  status_rotation_enabled: number;
};

export function getGuildSettings(guildId: string): GuildSettingsRow {
  const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  if (row) return row;
  // Insert default
  const insert = db.prepare(`
    INSERT INTO guild_settings (guild_id) VALUES (?)
  `);
  insert.run(guildId);
  // Return defaults
  return db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
}

export function setGuildSetting<T extends keyof GuildSettingsRow>(guildId: string, key: T, value: GuildSettingsRow[T]) {
  const stmt = db.prepare(`UPDATE guild_settings SET ${key} = ? WHERE guild_id = ?`);
  stmt.run(value as any, guildId);
}
