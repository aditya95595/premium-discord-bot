import { AuditLogEvent, Guild, PermissionFlagsBits, TextChannel } from 'discord.js';
import db from '../db';
import { getGuildSettings } from '../db/settings';
import { enableLockdown } from '../security/lockdown';
import { info, warn } from '../logger';

const recent=new Map<string,Array<{executor:string;ts:number;action:string}>>();
const auditType:Record<string,AuditLogEvent>={CHANNEL_DELETE:AuditLogEvent.ChannelDelete,ROLE_DELETE:AuditLogEvent.RoleDelete,BAN:AuditLogEvent.MemberBanAdd,KICK:AuditLogEvent.MemberKick,CHANNEL_UPDATE:AuditLogEvent.ChannelUpdate,ROLE_UPDATE:AuditLogEvent.RoleUpdate};
function trusted(settings:any,id:string,guild:Guild){return id===guild.ownerId||id===guild.client.user?.id||(settings.security_trusted_users||'').split(',').map((x:string)=>x.trim()).filter(Boolean).includes(id)}
async function alert(guild:Guild,action:string,executor:string,count:number){
  const settings=getGuildSettings(guild.id),channelId=settings.mod_log_channel;if(!channelId)return;
  const channel=guild.channels.cache.get(channelId);if(channel instanceof TextChannel)await channel.send(`🚨 **Security Alert**\nAction: \`${action}\`\nExecutor: <@${executor}> (${executor})\nDetected actions: **${count}**`).catch(()=>{});
}

export async function recordDestructiveAction(guild:Guild,action:string,targetId?:string){
  try{
    const settings=getGuildSettings(guild.id);if(!settings.security_enabled)return;
    const now=Date.now(),type=auditType[action]??AuditLogEvent.ChannelDelete;
    const logs=await guild.fetchAuditLogs({limit:8,type}).catch(()=>null);
    const entry=logs?.entries.find(x=>x.target?.id===targetId&&now-x.createdTimestamp<10000)||logs?.entries.find(x=>now-x.createdTimestamp<10000);
    const executorId=entry?.executor?.id;if(!executorId||trusted(settings,executorId,guild))return;
    const window=Math.max(10,Math.min(600,settings.security_window_seconds))*1000;
    const arr=(recent.get(guild.id)||[]).filter(x=>now-x.ts<=window);arr.push({executor:executorId,ts:now,action});recent.set(guild.id,arr);
    db.prepare('INSERT INTO audit_events(guild_id,action,target_id,executor_id,timestamp) VALUES(?,?,?,?,?)').run(guild.id,action,targetId??null,executorId,now);
    const count=arr.filter(x=>x.executor===executorId).length;
    await alert(guild,action,executorId,count);
    if(count<Math.max(2,settings.security_threshold))return;
    const mode=settings.security_action;
    if(mode==='lockdown'||mode==='ban_and_lockdown'){
      const result=await enableLockdown(guild,`Anti-nuke threshold reached by ${executorId}`);
      if(!result.ok)warn('Anti-nuke lockdown could not be applied',result.reason);
    }
    const member=guild.members.cache.get(executorId)||await guild.members.fetch(executorId).catch(()=>null);const bot=guild.members.me;
    if(mode==='ban_and_lockdown'&&member&&bot&&executorId!==guild.ownerId&&member.id!==bot.id&&member.roles.highest.position<bot.roles.highest.position&&bot.permissions.has(PermissionFlagsBits.BanMembers)){
      await member.ban({reason:'Anti-nuke: repeated destructive actions'}).then(()=>info('Anti-nuke blocked executor',executorId)).catch(e=>warn('Anti-nuke ban failed',e));
    }
  }catch(e){warn('recordDestructiveAction error',e instanceof Error?e.message:String(e));}
}
setInterval(()=>{const cutoff=Date.now()-15*60_000;for(const[k,v]of recent)if(!v.length||v[v.length-1].ts<cutoff)recent.delete(k)},60_000).unref();
