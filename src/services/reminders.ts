import type { Client } from 'discord.js';
import db from '../db';
import { error } from '../logger';

let timer: NodeJS.Timeout | undefined;
let running = false;

export function startReminderService(client: Client) {
  if (timer) return;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const rows = db.prepare(
        'SELECT * FROM reminders WHERE delivered=0 AND due_at<=? ORDER BY due_at LIMIT 25',
      ).all(Date.now()) as any[];

      for (const row of rows) {
        const channel = await client.channels.fetch(row.channel_id).catch(() => null);
        if (!channel?.isTextBased() || !('send' in channel)) {
          // Keep the reminder pending when the channel is temporarily unavailable.
          continue;
        }

        const sent = await channel.send(`<@${row.user_id}> ⏰ **Reminder:** ${row.text}`).then(() => true).catch(() => false);
        if (sent) {
          db.prepare('UPDATE reminders SET delivered=1 WHERE id=? AND delivered=0').run(row.id);
        }
      }
    } catch (e) {
      error('Reminder service error', e instanceof Error ? e.message : String(e));
    } finally {
      running = false;
    }
  };

  void tick();
  timer = setInterval(() => void tick(), 15000);
  timer.unref();
}

export function stopReminderService() {
  if (timer) clearInterval(timer);
  timer = undefined;
  running = false;
}
