import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import db from '../db';
const data=new SlashCommandBuilder().setName('history').setDescription('View recent moderation cases for a member').addUserOption(o=>o.setName('user').setDescription('Member').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);
function run(s:any,id:string){const rows:any[]=db.prepare('SELECT * FROM infractions WHERE guild_id=? AND user_id=? ORDER BY timestamp DESC LIMIT 15').all(s.guild.id,id);if(!rows.length)return 'No moderation history found.';return rows.map(r=>`#${r.id} **${r.type}** — ${r.reason||'No reason'} — <t:${Math.floor(r.timestamp/1000)}:R>`).join('\n');}
async function executeSlash(i:any){return i.reply({content:run(i,i.options.getUser('user',true).id),ephemeral:true});}async function executePrefix(m:any,args:string[]){const id=args[0]?.replace(/[<@!>]/g,'');if(!id)return m.reply('Usage: !history @user');return m.reply(run(m,id));}
export={name:'history',description:'View recent moderation cases',permissions:['ManageMessages'],data,executeSlash,executePrefix};
