import db from './index';

export function addInfraction(guildId: string, userId: string, moderatorId: string | null, type: string, reason: string | null) {
  const ts = Date.now();
  const stmt = db.prepare(`INSERT INTO infractions (guild_id, user_id, moderator_id, type, reason, timestamp) VALUES (?, ?, ?, ?, ?, ?)`);
  const res = stmt.run(guildId, userId, moderatorId, type, reason, ts);
  return res.lastInsertRowid as number;
}

export function getInfractions(guildId: string, userId: string) {
  return db.prepare(`SELECT * FROM infractions WHERE guild_id = ? AND user_id = ? ORDER BY timestamp DESC`).all(guildId, userId);
}
