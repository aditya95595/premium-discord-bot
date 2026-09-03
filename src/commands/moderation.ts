import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { addInfraction } from '../db/infractions';
import { isIdLike } from '../utils/validation';

const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Remove a member from this server with an optional reason.')
  .addUserOption(o => o.setName('target').setDescription('The server member to remove.').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Optional reason recorded with the moderation action.'))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

async function executeSlash(interaction: any) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This command must be used in a guild.', ephemeral: true });
  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason') ?? 'No reason';
  const member = guild.members.cache.get(target.id) || await guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
  if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ content: 'You lack permission to kick members.', ephemeral: true });
  }
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ content: 'I do not have permission to kick members.', ephemeral: true });
  }
  if (member.id === interaction.user.id) return interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });
  if (member.id === guild.ownerId) return interaction.reply({ content: 'The server owner cannot be kicked.', ephemeral: true });
  if (member.roles.highest.position >= (interaction.member as any).roles.highest.position) {
    return interaction.reply({ content: 'You cannot kick a member with an equal or higher role.', ephemeral: true });
  }
  if (member.roles.highest.position >= me.roles.highest.position) {
    return interaction.reply({ content: 'My highest role must be above the target member.', ephemeral: true });
  }
  try {
    await member.kick(reason);
  } catch (e: any) {
    return interaction.reply({ content: 'Failed to kick: ' + (e?.message ?? 'unknown error'), ephemeral: true });
  }
  addInfraction(guild.id, member.id, interaction.user.id, 'kick', reason);
  return interaction.reply({ content: `Kicked ${member.user.tag}.` });
}

async function executePrefix(message: any, args: string[]) {
  const guild = message.guild;
  if (!guild) return message.reply('This command must be used in a server.');
  if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('You lack Kick Members permission.');
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('I lack Kick Members permission.');
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  if (!targetId || !isIdLike(targetId)) return message.reply('Usage: kick @user [reason]');
  const member = guild.members.cache.get(targetId) || await guild.members.fetch(targetId).catch(() => null);
  if (!member) return message.reply('Member not found.');
  if (member.id === message.author.id) return message.reply('You cannot kick yourself.');
  if (member.id === guild.ownerId) return message.reply('The server owner cannot be kicked.');
  if (member.roles.highest.position >= message.member.roles.highest.position) return message.reply('You cannot kick a member with an equal or higher role.');
  if (member.roles.highest.position >= me.roles.highest.position) return message.reply('My highest role must be above the target member.');
  const reason = args.slice(1).join(' ') || 'No reason';
  try {
    await member.kick(reason);
  } catch (e: any) {
    return message.reply('Failed to kick: ' + (e?.message ?? 'unknown error'));
  }
  addInfraction(guild.id, member.id, message.author.id, 'kick', reason);
  return message.channel.send(`Kicked ${member.user.tag}.`);
}

export default {
  name: 'kick',
  description: 'Remove a member from this server with an optional reason.',
  permissions: ['KickMembers'],
  data,
  executeSlash,
  executePrefix
};
