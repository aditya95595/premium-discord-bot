import type { Client } from 'discord.js';
import db from '../db';
import { error } from '../logger';
let timer:NodeJS.Timeout|undefined;
export function startReminderService(client:Client){if(timer)return;const tick=async()=>{try{const rows=db.prepare('SELECT * FROM reminders WHERE delivered=0 AND due_at<=? ORDER BY due_at LIMIT 25').all(Date.now()) as any[];for(const r of rows){db.prepare('UPDATE reminders SET delivered=1 WHERE id=? AND delivered=0').run(r.id);const ch=await client.channels.fetch(r.channel_id).catch(()=>null);if(ch?.isTextBased())await ch.send(`<@${r.user_id}> ⏰ **Reminder:** ${r.text}`).catch(()=>{});}}catch(e){error('Reminder service error',e);}};void tick();timer=setInterval(()=>void tick(),15000);timer.unref();}
export function stopReminderService(){if(timer){clearInterval(timer);timer=undefined;}}
