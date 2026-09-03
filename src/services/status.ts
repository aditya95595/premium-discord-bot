import { ActivityType, type Client } from 'discord.js';
import db from '../db';
import { getGuildSettings } from '../db/settings';
const timers = new Map<string, NodeJS.Timeout>();
const typeMap: Record<string, ActivityType> = { PLAYING: ActivityType.Playing, STREAMING: ActivityType.Streaming, LISTENING: ActivityType.Listening, WATCHING: ActivityType.Watching, COMPETING: ActivityType.Competing };
export async function applyStatusSettings(client: Client) {
  for (const guild of client.guilds.cache.values()) {
    const settings = getGuildSettings(guild.id);
    const statuses = db.prepare('SELECT text,type FROM statuses WHERE guild_id=? ORDER BY position,id').all(guild.id) as Array<{text:string,type:string}>;
    const key = guild.id;
    if (timers.has(key)) clearInterval(timers.get(key)!);
    if (!settings.status_rotation_enabled || !statuses.length) continue;
    let index = 0;
    const set = () => { const item = statuses[index++ % statuses.length]; client.user?.setActivity(item.text, { type: typeMap[item.type] ?? ActivityType.Playing }); };
    set();
    timers.set(key, setInterval(set, Math.max(15, settings.status_rotation_interval) * 1000));
  }
}
export function clearStatusTimers() { for (const timer of timers.values()) clearInterval(timer); timers.clear(); }
