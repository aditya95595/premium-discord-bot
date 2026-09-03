import type { Client } from 'discord.js';
import db from '../db';
import { warn } from '../logger';

let timer: NodeJS.Timeout | undefined;

export function startTemporaryPunishmentService(client: Client) {
  if (timer) return;
  const tick = async () => {
    try {
      const rows = db.prepare("SELECT * FROM infractions WHERE expires_at IS NOT NULL AND expires_at <= ? AND type IN ('timeout','tempban') ORDER BY expires_at LIMIT 25").all(Date.now()) as any[];
      for (const row of rows) {
        const guild = client.guilds.cache.get(row.guild_id);
        if (!guild) continue;
        let completed=false;
        if (row.type === 'timeout') {
          const member = await guild.members.fetch(row.user_id).catch(() => null);
          if (!member) completed=true; // They left; there is no active timeout to clear.
          else if (!member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp<=Date.now()) completed=true;
          else completed=await member.timeout(null, 'Temporary timeout expired').then(()=>true).catch(()=>false);
        } else if (row.type === 'tempban') {
          completed=await guild.members.unban(row.user_id, 'Temporary ban expired').then(()=>true).catch(()=>false);
        }
        if(completed)db.prepare('UPDATE infractions SET expires_at=NULL WHERE id=? AND expires_at IS NOT NULL').run(row.id);
      }
    } catch (e) { warn('Temporary punishment service error', e instanceof Error ? e.message : String(e)); }
  };
  void tick();
  timer = setInterval(() => void tick(), 15000);
  timer.unref();
}

export function stopTemporaryPunishmentService() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
