import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getInfractions } from '../db/infractions';
const data=new SlashCommandBuilder().setName('warnings').setDescription('View a member moderation history').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
async function run(s:any,id:string){const rows:any[]=getInfractions(s.guild.id,id);if(!rows.length)return 'No warnings or moderation cases found.';return rows.slice(0,10).map((r,i)=>`**${i+1}. ${r.type}** — ${r.reason||'No reason'} <t:${Math.floor(r.timestamp/1000)}:R>`).join('\n');}
async function executeSlash(i:any){try{return i.reply({content:await run(i,i.options.getUser('user',true).id),ephemeral:true});}catch(e){return i.reply({content:'Unable to read history.',ephemeral:true});}}
async function executePrefix(m:any,args:string[]){const id=args[0]?.replace(/[<@!>]/g,'');if(!id)return m.reply('Usage: !warnings @user');return m.reply(await run(m,id));}
export={name:'warnings',description:'View moderation history',permissions:['ManageMessages'],data,executeSlash,executePrefix};
