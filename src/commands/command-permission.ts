import { SlashCommandBuilder } from 'discord.js';
import { addCommandRole, getCommandRoleIds, removeCommandRole, resetCommandRoles, validateCommandName, validateRoleId } from '../utils/command-permissions';
import { getGuildSettings } from '../db/settings';

const data = new SlashCommandBuilder()
  .setName('command-permission').setDescription('Owner-only: control which roles can use commands')
  .addSubcommand(s => s.setName('add').setDescription('Allow a role to use a command').addStringOption(o => o.setName('command').setDescription('Command name').setRequired(true).setMaxLength(32)).addRoleOption(o => o.setName('role').setDescription('Allowed role').setRequired(true)))
  .addSubcommand(s => s.setName('remove').setDescription('Remove a role from a command').addStringOption(o => o.setName('command').setDescription('Command name').setRequired(true).setMaxLength(32)).addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
  .addSubcommand(s => s.setName('reset').setDescription('Remove all custom roles for a command').addStringOption(o => o.setName('command').setDescription('Command name').setRequired(true).setMaxLength(32)))
  .addSubcommand(s => s.setName('view').setDescription('View command role restrictions').addStringOption(o => o.setName('command').setDescription('Command name').setRequired(true).setMaxLength(32)));

function commandFromRegistry(source: any, raw: string): string {
  const command = validateCommandName(raw);
  if (!command) throw new Error('Invalid command name. Use letters, numbers, hyphens or underscores.');
  const commands = (source.client as any)?.commands as Map<string, unknown> | undefined;
  if (!commands?.has(command)) throw new Error(`Unknown command **${command}**. Use \`/help\` to see available commands.`);
  if (command === 'command-permission') throw new Error('This command is permanently owner-only and cannot be delegated.');
  return command;
}
function roleFromPrefix(raw: string | undefined): string | null { if (!raw) return null; const mention = raw.match(/^<@&(\d{15,25})>$/); return mention?.[1] ?? validateRoleId(raw); }

function run(source: any, sub: string, rawCommand: string, roleId?: string) {
  if (!source.guild) throw new Error('This command can only be used in a server.');
  const command = commandFromRegistry(source, rawCommand);
  if (sub === 'view') { const roles = getCommandRoleIds(source.guild.id, command); return roles.length ? `**${command}** → ${roles.map(id => `<@&${id}>`).join(', ')}\nOnly these roles can use it, subject to the command's normal Discord permissions.` : `**${command}** → No custom role restriction. Anyone who passes the command's normal Discord permissions can use it.`; }
  if (sub === 'reset') { const removed = resetCommandRoles(source.guild.id, command); return removed ? `Reset **${command}**. Removed ${removed} role restriction${removed === 1 ? '' : 's'}.` : `**${command}** already has no custom role restrictions.`; }
  if (!roleId) throw new Error('A role is required.');
  const role = source.guild.roles.cache.get(roleId);
  if (!role) throw new Error('That role does not exist in this server.');
  if (role.id === source.guild.id) throw new Error('You cannot use @everyone as a command role.');
  if (role.managed) throw new Error('Managed/integration roles cannot be used for command permissions.');
  if (sub === 'add') return addCommandRole(source.guild.id, command, role.id) ? `Allowed <@&${role.id}> to use **${command}**.` : `<@&${role.id}> is already allowed to use **${command}**.`;
  if (sub === 'remove') return removeCommandRole(source.guild.id, command, role.id) ? `Removed <@&${role.id}> from **${command}**.` : `<@&${role.id}> was not configured for **${command}**.`;
  throw new Error('Invalid action.');
}
async function executeSlash(i:any){try{const sub=i.options.getSubcommand();return i.reply({content:run(i,sub,i.options.getString('command',true),i.options.getRole('role')?.id),ephemeral:true});}catch(e){return i.reply({content:e instanceof Error?e.message:'Invalid request.',ephemeral:true});}}
async function executePrefix(m:any,args:string[]){const prefix=getGuildSettings(m.guild.id).prefix||'!';const sub=(args[0]||'').toLowerCase(),command=args[1],role=roleFromPrefix(args[2]);if(!['add','remove','reset','view'].includes(sub)||!command||((sub==='add'||sub==='remove')&&!role))return m.reply(`Usage: ${prefix}command-permission <add|remove|reset|view> <command> [@role]`);try{return m.reply(run(m,sub,command,role??undefined));}catch(e){return m.reply(e instanceof Error?e.message:'Invalid request.');}}
export default {name:'command-permission',description:'Owner-only command role access control',ownerOnly:true,cooldown:2,data,executeSlash,executePrefix};
