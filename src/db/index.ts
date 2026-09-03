import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { info } from '../logger';

const DB_PATH = process.env.DB_PATH || './data/bot.sqlite';

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize schema if missing
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  prefix TEXT NOT NULL DEFAULT '!',
  automod_enabled INTEGER NOT NULL DEFAULT 1,
  automod_profanity INTEGER NOT NULL DEFAULT 1,
  automod_caps INTEGER NOT NULL DEFAULT 1,
  automod_links INTEGER NOT NULL DEFAULT 1,
  automod_spam_threshold INTEGER NOT NULL DEFAULT 5,
  mod_log_channel TEXT,
  raid_mode INTEGER NOT NULL DEFAULT 0,
  status_rotation_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS infractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT,
  type TEXT NOT NULL,
  reason TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'PLAYING',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS joins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  executor_id TEXT,
  timestamp INTEGER NOT NULL
);
`);

info('Database opened at', DB_PATH);

export default db;
