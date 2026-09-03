import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { addInfraction, getInfractions } from '../db/infractions';
import { getGuildSettings } from '../db/settings';
import { isIdLike } from '../utils/validation';

const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a member')
  .addUserOption(o => o.setName('target').setDescription('Member to kick').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

async function executeSlash(interaction: any) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This command must be used in a guild.', ephemeral: true });
  const target = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason') ?? 'No reason';
  const member = guild.members.cache.get(target.id) || await guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ content: 'Member not found.', ephemeral: true });
  // Permission checks and role hierarchy
  if (!interaction.memberPermissions.has('KickMembers')) {
    return interaction.reply({ content: 'You lack permission to kick.', ephemeral: true });
  }
  if (!guild.members.me?.permissions.has('KickMembers')) {
    return interaction.reply({ content: 'I do not have permission to kick members.', ephemeral: true });
  }
  if (member.roles.highest.position >= (interaction.member as any).roles.highest.position) {
    return interaction.reply({ content: 'You cannot kick a member with equal or higher role.', ephemeral: true });
  }
  await member.kick(reason).catch((e: any) => {
    return interaction.reply({ content: 'Failed to kick: ' + (e.message ?? 'unknown'), ephemeral: true });
  });
  addInfraction(guild.id, member.id, interaction.user.id, 'kick', reason);
  interaction.reply({ content: `Kicked ${member.user.tag}.` });
}

async function executePrefix(message: any, args: string[]) {
  // Very similar to slash, but args parsing
  const guild = message.guild;
  if (!guild) return message.reply('This command must be used in a server.');
  if (!message.member.permissions.has('KickMembers')) return message.reply('You lack KickMembers permission.');
  if (!guild.members.me?.permissions.has('KickMembers')) return message.reply('I lack KickMembers permission.');
  const targetId = args[0];
  if (!targetId || !isIdLike(targetId)) return message.reply('Please give a valid user id or mention.');
  const member = guild.members.cache.get(targetId) || await guild.members.fetch(targetId).catch(() => null);
  if (!member) return message.reply('Member not found.');
  if (member.roles.highest.position >= message.member.roles.highest.position) return message.reply('You cannot kick that member.');
  const reason = args.slice(1).join(' ') || 'No reason';
  await member.kick(reason).catch((e:any) => message.reply('Failed to kick: ' + e.message));
  addInfraction(guild.id, member.id, message.author.id, 'kick', reason);
  message.channel.send(`Kicked ${member.user.tag}.`);
}

export = {
  name: 'kick',
  description: 'Kick a member',
  data,
  executeSlash,
  executePrefix
};
