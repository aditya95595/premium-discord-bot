import { Message, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings } from '../db/settings';
import { addInfraction } from '../db/infractions';
import { warn as logWarn } from '../logger';

const PROFANITY=['badword1','badword2','badword3'];
const URL=/(https?:\/\/[^\s]+)/i;
const INVITE=/(discord(?:\.gg|\.com\/invite)\/[^\s]+)/i;
const recent=new Map<string,number[]>();
const duplicate=new Map<string,{text:string;count:number;ts:number}>();
function prune(key:string,now:number){const a=(recent.get(key)||[]).filter(t=>now-t<10000);recent.set(key,a);return a;}
export async function runAutoMod(message:Message){
  if(!message.guild||message.author.bot)return;
  const s=getGuildSettings(message.guild.id),c=message.content||'',now=Date.now(),key=`${message.guild.id}:${message.author.id}`;
  if(!s.automod_enabled)return;
  const member=message.member;
  if(member?.permissions.has(PermissionFlagsBits.ManageMessages)||member?.permissions.has(PermissionFlagsBits.Administrator))return;
  const punish=async(type:string,reason:string)=>{await message.delete().catch(()=>{});addInfraction(message.guild!.id,message.author.id,null,type,reason);logWarn('AutoMod action',{guild:message.guild!.id,user:message.author.id,type});};
  const arr=prune(key,now);arr.push(now);recent.set(key,arr);
  if(arr.length>=Math.max(3,s.automod_spam_threshold))return punish('automod-spam','rapid messages');
  const normalized=c.trim().toLowerCase();
  const d=duplicate.get(key);if(normalized&&d&&d.text===normalized&&now-d.ts<15000){d.count++;d.ts=now;if(d.count>=3)return punish('automod-duplicate','repeated message');}else duplicate.set(key,{text:normalized,count:1,ts:now});
  if(s.automod_mention_limit>0&&message.mentions.users.size+message.mentions.roles.size>=s.automod_mention_limit)return punish('automod-mentions','mention spam');
  if(s.automod_invites&&INVITE.test(c))return punish('automod-invite','discord invite');
  if(s.automod_links&&URL.test(c))return punish('automod-link','link');
  const blocked=(s.automod_blocked_words||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);if(blocked.some(w=>c.toLowerCase().includes(w)))return punish('automod-word','blocked word');
  if(s.automod_profanity&&PROFANITY.some(w=>c.toLowerCase().includes(w)))return punish('automod-profanity','profanity');
  if(s.automod_caps){const letters=c.replace(/[^A-Za-z]/g,'');const caps=letters.replace(/[^A-Z]/g,'').length;if(letters.length>=8&&caps/letters.length>.8)return punish('automod-caps','excessive caps');}
}
setInterval(()=>{const cutoff=Date.now()-30000;for(const[k,v]of duplicate)if(v.ts<cutoff)duplicate.delete(k);for(const[k,v]of recent)if(!v.length||v[v.length-1]<cutoff)recent.delete(k);},15000).unref();
