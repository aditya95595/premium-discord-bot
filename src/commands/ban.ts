import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { addInfraction } from '../db/infractions';
import { isIdLike } from '../utils/validation';

const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a member')
  .addUserOption(o => o.setName('target').setDescription('Member to ban').setRequired(true))
  .addIntegerOption(o => o.setName('days').setDescription('Delete messages (days)').setMinValue(0).setMaxValue(7))
  .addStringOption(o => o.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

async function executeSlash(interaction: any) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'This command must be used in a guild.', ephemeral: true });
  const user = interaction.options.getUser('target', true);
  const days = interaction.options.getInteger('days') ?? 0;
  const reason = interaction.options.getString('reason') ?? 'No reason';
  if (!interaction.memberPermissions.has('BanMembers')) return interaction.reply({ content: 'You lack BanMembers permission.', ephemeral: true });
  if (!guild.members.me?.permissions.has('BanMembers')) return interaction.reply({ content: 'I lack BanMembers permission.', ephemeral: true });
  // Can't check hierarchy against non-members. We attempt to fetch member if present.
  const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
  if (member && member.roles.highest.position >= (interaction.member as any).roles.highest.position) {
    return interaction.reply({ content: 'You cannot ban that member due to role hierarchy.', ephemeral: true });
  }
  await guild.bans.create(user.id, { days, reason }).catch((e:any) => {
    return interaction.reply({ content: 'Failed to ban: ' + (e.message ?? 'unknown'), ephemeral: true });
  });
  addInfraction(guild.id, user.id, interaction.user.id, 'ban', reason);
  return interaction.reply({ content: `Banned ${user.tag}.` });
}

async function executePrefix(message: any, args: string[]) {
  const guild = message.guild;
  if (!guild) return message.reply('This must be used in a guild.');
  if (!message.member.permissions.has('BanMembers')) return message.reply('You lack permission.');
  if (!guild.members.me?.permissions.has('BanMembers')) return message.reply('I lack permission.');
  const target = args[0];
  if (!target || !isIdLike(target)) return message.reply('Provide a user id.');
  const days = Number(args[1]) || 0;
  const reason = args.slice(2).join(' ') || 'No reason';
  await guild.bans.create(target, { days, reason }).catch((e:any) => message.reply('Failed to ban: ' + e.message));
  addInfraction(guild.id, target, message.author.id, 'ban', reason);
  message.channel.send(`Banned <@${target}>.`);
}

export = {
  name: 'ban',
  description: 'Ban a member',
  data,
  executeSlash,
  executePrefix
};
