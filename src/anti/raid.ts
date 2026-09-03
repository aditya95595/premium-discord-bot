import { GuildMember } from 'discord.js';
import { info, warn } from '../logger';
import db from '../db';
import { getGuildSettings } from '../db/settings';

const recentJoins=new Map<string,{ts:number;count:number}>();
export function recordJoin(member:GuildMember){
  try{
    const guild=member.guild, settings=getGuildSettings(guild.id), now=Date.now();
    const old=recentJoins.get(guild.id);
    const entry=!old||now-old.ts>settings.raid_window_seconds*1000?{ts:now,count:1}:{ts:old.ts,count:old.count+1};
    recentJoins.set(guild.id,entry);
    if(entry.count>=settings.raid_threshold){
      db.prepare('UPDATE guild_settings SET raid_mode=1 WHERE guild_id=?').run(guild.id);
      db.prepare('INSERT INTO audit_events(guild_id,action,target_id,timestamp) VALUES(?,?,?,?)').run(guild.id,'raid_trigger',member.id,now);
      info(`Raid protection triggered for guild ${guild.id}: ${entry.count} joins`);
    }
  }catch(e){warn('recordJoin error',e instanceof Error?e.message:String(e));}
}
setInterval(()=>{const cutoff=Date.now()-10*60_000;for(const[k,v]of recentJoins)if(v.ts<cutoff)recentJoins.delete(k);},60_000).unref();
