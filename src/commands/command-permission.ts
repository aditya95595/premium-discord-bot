import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import db from '../db';

const data=new SlashCommandBuilder().setName('command-permission').setDescription('Manage role access to commands').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
.addSubcommand(s=>s.setName('add').setDescription('Allow a role to use a command').addStringOption(o=>o.setName('command').setDescription('Command name').setRequired(true)).addRoleOption(o=>o.setName('role').setDescription('Allowed role').setRequired(true)))
.addSubcommand(s=>s.setName('remove').setDescription('Remove a role from a command').addStringOption(o=>o.setName('command').setDescription('Command name').setRequired(true)).addRoleOption(o=>o.setName('role').setDescription('Role').setRequired(true)))
.addSubcommand(s=>s.setName('reset').setDescription('Remove all custom roles for a command').addStringOption(o=>o.setName('command').setDescription('Command name').setRequired(true)))
.addSubcommand(s=>s.setName('view').setDescription('View command role restrictions').addStringOption(o=>o.setName('command').setDescription('Command name').setRequired(true)));

function run(source:any,sub:string,command:string,roleId?:string){
  if(!source.guild)throw new Error('This command can only be used in a server.');
  if(!source.member.permissions.has(PermissionFlagsBits.ManageGuild)&&!source.member.permissions.has(PermissionFlagsBits.Administrator))throw new Error('Manage Server permission is required.');
  command=command.toLowerCase();
  if(!/^[a-z0-9_-]{1,32}$/.test(command))throw new Error('Invalid command name.');
  if(['add','remove'].includes(sub)&&!roleId)throw new Error('A role is required.');
  if(sub==='add'){db.prepare('INSERT OR IGNORE INTO command_permissions(guild_id,command_name,role_id) VALUES(?,?,?)').run(source.guild.id,command,roleId);return 'Role permission added.';}
  if(sub==='remove'){db.prepare('DELETE FROM command_permissions WHERE guild_id=? AND command_name=? AND role_id=?').run(source.guild.id,command,roleId);return 'Role permission removed.';}
  if(sub==='reset'){db.prepare('DELETE FROM command_permissions WHERE guild_id=? AND command_name=?').run(source.guild.id,command);return 'Command permissions reset.';}
  const rows=db.prepare('SELECT role_id FROM command_permissions WHERE guild_id=? AND command_name=?').all(source.guild.id,command) as Array<{role_id:string}>;
  return rows.length?`Allowed roles: ${rows.map(r=>`<@&${r.role_id}>`).join(', ')}`:'No custom role restriction (native Discord permissions still apply).';
}

async function executeSlash(i:any){try{const s=i.options.getSubcommand();return i.reply({content:run(i,s,i.options.getString('command',true),i.options.getRole('role')?.id),ephemeral:true});}catch(e){return i.reply({content:e instanceof Error?e.message:'Invalid request.',ephemeral:true});}}

async function executePrefix(m:any,args:string[]){
  const sub=(args[0]||'').toLowerCase();
  const command=args[1];
  const role=args[2]?.replace(/[<@&>]/g,'');
  if(!['add','remove','reset','view'].includes(sub)||!command||((sub==='add'||sub==='remove')&&!/^\d{15,25}$/.test(role||'')))return m.reply(`Usage: ${m.guild?.client?.context?.prefix||'!'}command-permission <add|remove|reset|view> <command> [@role]`);
  try{return m.reply(run(m,sub,command,role));}catch(e){return m.reply(e instanceof Error?e.message:'Invalid request.');}
}

export={name:'command-permission',description:'Manage role access to commands',adminOnly:true,permissions:['ManageGuild'],data,executeSlash,executePrefix};
