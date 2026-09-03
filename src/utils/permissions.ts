import db from '../db';
import type { Command } from '../commands/command-loader';
import { PermissionFlagsBits, type GuildMember } from 'discord.js';
const bits: Record<string, bigint> = { BanMembers: PermissionFlagsBits.BanMembers, KickMembers: PermissionFlagsBits.KickMembers, ModerateMembers: PermissionFlagsBits.ModerateMembers, ManageMessages: PermissionFlagsBits.ManageMessages, ManageGuild: PermissionFlagsBits.ManageGuild, ManageChannels: PermissionFlagsBits.ManageChannels, ManageRoles: PermissionFlagsBits.ManageRoles, Administrator: PermissionFlagsBits.Administrator };
export function hasCustomRole(guildId: string, commandName: string, member: GuildMember) {
  const rows = db.prepare('SELECT role_id FROM command_permissions WHERE guild_id=? AND command_name=?').all(guildId, commandName) as Array<{role_id:string}>;
  if (!rows.length || member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return rows.some(row => member.roles.cache.has(row.role_id));
}
export function canUseCommand(source: any, command: Command, ownerId: string) {
  if (!source.guild) return { ok:false, reason:'This command can only be used in a server.' };
  const member = source.member as GuildMember | null;
  if (!member?.permissions) return { ok:false, reason:'Unable to verify your permissions.' };
  if (command.ownerOnly && source.user?.id !== ownerId && source.author?.id !== ownerId) return { ok:false, reason:'Owner only.' };
  if (command.adminOnly && !member.permissions.has(PermissionFlagsBits.ManageGuild) && !member.permissions.has(PermissionFlagsBits.Administrator)) return { ok:false, reason:'Manage Server permission is required.' };
  for (const name of command.permissions ?? []) { const bit = bits[name]; if (bit && !member.permissions.has(bit)) return { ok:false, reason:`You need ${name} permission.` }; }
  if (!hasCustomRole(source.guild.id, command.name, member)) return { ok:false, reason:'You are not allowed to use this command.' };
  return { ok:true };
}
export function canTarget(actor: GuildMember, target: GuildMember, bot: GuildMember) {
  if (target.id === actor.id) return 'You cannot target yourself.';
  if (target.id === actor.guild.ownerId) return 'You cannot target the server owner.';
  if (target.id === bot.id) return 'I cannot target myself.';
  if (actor.id !== actor.guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) return 'Your highest role must be above the target.';
  if (target.roles.highest.position >= bot.roles.highest.position) return 'My highest role must be above the target.';
  return null;
}
