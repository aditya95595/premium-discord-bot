import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { info } from '../logger';
const DB_PATH = process.env.DB_PATH || './data/bot.sqlite';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (guild_id TEXT PRIMARY KEY,prefix TEXT NOT NULL DEFAULT '!',automod_enabled INTEGER NOT NULL DEFAULT 1,automod_profanity INTEGER NOT NULL DEFAULT 1,automod_caps INTEGER NOT NULL DEFAULT 1,automod_links INTEGER NOT NULL DEFAULT 1,automod_spam_threshold INTEGER NOT NULL DEFAULT 5,automod_mention_limit INTEGER NOT NULL DEFAULT 5,automod_invites INTEGER NOT NULL DEFAULT 1,automod_blocked_words TEXT NOT NULL DEFAULT '',automod_punishment TEXT NOT NULL DEFAULT 'delete',mod_log_channel TEXT,staff_roles TEXT NOT NULL DEFAULT '',raid_mode INTEGER NOT NULL DEFAULT 0,raid_threshold INTEGER NOT NULL DEFAULT 6,raid_window_seconds INTEGER NOT NULL DEFAULT 60,status_rotation_enabled INTEGER NOT NULL DEFAULT 0,status_rotation_interval INTEGER NOT NULL DEFAULT 60,security_enabled INTEGER NOT NULL DEFAULT 1,security_action TEXT NOT NULL DEFAULT 'alert',security_threshold INTEGER NOT NULL DEFAULT 5,security_window_seconds INTEGER NOT NULL DEFAULT 30,security_trusted_users TEXT NOT NULL DEFAULT '',coc_clan_tag TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS infractions (id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,user_id TEXT NOT NULL,moderator_id TEXT,type TEXT NOT NULL,reason TEXT,timestamp INTEGER NOT NULL,expires_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_infractions ON infractions(guild_id,user_id,timestamp DESC);
CREATE TABLE IF NOT EXISTS command_permissions (guild_id TEXT NOT NULL,command_name TEXT NOT NULL,role_id TEXT NOT NULL,PRIMARY KEY(guild_id,command_name,role_id));
CREATE TABLE IF NOT EXISTS statuses (id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,text TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'PLAYING',position INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_statuses ON statuses(guild_id,position);
CREATE TABLE IF NOT EXISTS joins (id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,user_id TEXT NOT NULL,timestamp INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT,executor_id TEXT,timestamp INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit ON audit_events(guild_id,timestamp DESC);
CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,user_id TEXT NOT NULL,channel_id TEXT NOT NULL,text TEXT NOT NULL,due_at INTEGER NOT NULL,delivered INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_reminders ON reminders(delivered,due_at);
CREATE TABLE IF NOT EXISTS lockdown_overwrites (guild_id TEXT NOT NULL,channel_id TEXT NOT NULL,allow TEXT NOT NULL DEFAULT '0',deny TEXT NOT NULL DEFAULT '0',PRIMARY KEY(guild_id,channel_id));
CREATE INDEX IF NOT EXISTS idx_lockdown_overwrites ON lockdown_overwrites(guild_id);
`);
try{db.exec("ALTER TABLE guild_settings ADD COLUMN coc_clan_tag TEXT NOT NULL DEFAULT ''");}catch{}
info('Database opened at', DB_PATH);
export default db;
