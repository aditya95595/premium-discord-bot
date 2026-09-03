import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getInfractions } from '../db/infractions';
const data=new SlashCommandBuilder().setName('warnings').setDescription('View a member moderation history').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true));
async function run(s:any,id:string){const rows:any[]=getInfractions(s.guild.id,id);if(!rows.length)return 'No moderation cases found.';return rows.slice(0,15).map((r,i)=>`**#${r.id} · ${r.type}** — ${r.reason||'No reason'} · <@${r.moderator_id||'0'}> · <t:${Math.floor(r.timestamp/1000)}:R>${r.expires_at?` · expires <t:${Math.floor(r.expires_at/1000)}:R>`:''}`).join('\n');}
async function executeSlash(i:any){try{return i.reply({content:await run(i,i.options.getUser('user',true).id),ephemeral:true});}catch{return i.reply({content:'Unable to read moderation history.',ephemeral:true});}}
async function executePrefix(m:any,args:string[]){const id=args[0]?.replace(/[<@!>]/g,'');if(!/^\d{15,25}$/.test(id||''))return m.reply('Usage: !warnings @user');return m.reply(await run(m,id));}
export={name:'warnings',description:'View moderation history',permissions:['ManageMessages'],data,executeSlash,executePrefix};
