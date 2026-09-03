import { ActivityType, type Client, type PresenceStatusData } from 'discord.js';
import db from '../db';
import { getGuildSettings } from '../db/settings';

let timer: NodeJS.Timeout | undefined;
const typeMap: Record<string, ActivityType> = { PLAYING: ActivityType.Playing, STREAMING: ActivityType.Streaming, LISTENING: ActivityType.Listening, WATCHING: ActivityType.Watching, COMPETING: ActivityType.Competing };

export async function applyStatusSettings(client: Client) {
  if (timer) clearInterval(timer);
  timer = undefined;
  const first = client.guilds.cache.values().next().value as any;
  if (!first) return;
  const settings = getGuildSettings(first.id);
  const statuses = db.prepare('SELECT text,type FROM statuses WHERE guild_id=? ORDER BY position,id').all(first.id) as Array<{text:string,type:string}>;
  if (!settings.status_rotation_enabled || !statuses.length) return;
  let index = 0;
  const set = () => {
    const item = statuses[index++ % statuses.length];
    client.user?.setActivity(item.text, { type: typeMap[item.type] ?? ActivityType.Playing });
  };
  set();
  timer = setInterval(set, Math.max(15, settings.status_rotation_interval) * 1000);
  timer.unref();
}

export function setGlobalPresence(client: Client, text: string, type: ActivityType, status: PresenceStatusData = 'online') {
  client.user?.setPresence({ status, activities: [{ name: text, type }] });
}

export function clearStatusTimers() { if (timer) clearInterval(timer); timer = undefined; }
