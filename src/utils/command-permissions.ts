import db from '../db';

export type CommandPermissionAction = 'add' | 'remove' | 'reset' | 'view';

type RoleRow = { role_id: string };

const commandNamePattern = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
const roleIdPattern = /^\d{15,25}$/;

export function normalizeCommandName(value: string): string {
  return value.trim().replace(/^[/!]/, '').toLowerCase();
}

export function validateCommandName(value: string): string | null {
  const name = normalizeCommandName(value);
  return commandNamePattern.test(name) ? name : null;
}

export function validateRoleId(value: string): string | null {
  const id = value.trim().replace(/[<@&>]/g, '');
  return roleIdPattern.test(id) ? id : null;
}

export function getCommandRoleIds(guildId: string, commandName: string): string[] {
  const name = normalizeCommandName(commandName);
  const rows = db.prepare('SELECT role_id FROM command_permissions WHERE guild_id=? AND command_name=? ORDER BY role_id').all(guildId, name) as RoleRow[];
  return rows.map(row => row.role_id);
}

export function addCommandRole(guildId: string, commandName: string, roleId: string): boolean {
  const result = db.prepare('INSERT OR IGNORE INTO command_permissions(guild_id,command_name,role_id) VALUES(?,?,?)').run(guildId, normalizeCommandName(commandName), roleId);
  return result.changes > 0;
}

export function removeCommandRole(guildId: string, commandName: string, roleId: string): boolean {
  const result = db.prepare('DELETE FROM command_permissions WHERE guild_id=? AND command_name=? AND role_id=?').run(guildId, normalizeCommandName(commandName), roleId);
  return result.changes > 0;
}

export function resetCommandRoles(guildId: string, commandName: string): number {
  const result = db.prepare('DELETE FROM command_permissions WHERE guild_id=? AND command_name=?').run(guildId, normalizeCommandName(commandName));
  return result.changes;
}

export function formatCommandRoles(guildId: string, commandName: string): string {
  const roles = getCommandRoleIds(guildId, commandName);
  if (!roles.length) return 'Everyone who passes the command\'s normal Discord permissions can use it.';
  return roles.map(id => `<@&${id}>`).join(', ');
}
