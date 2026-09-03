import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { addInfraction, getInfractions } from '../db/infractions';

const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a member (logs to infractions)')
  .addUserOption(o => o.setName('target').setDescription('Member to warn').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Reason'))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

async function executeSlash(interaction: any) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Guild only.', ephemeral: true });
  const user = interaction.options.getUser('target', true);
  const reason = interaction.options.getString('reason') ?? 'No reason';
  if (!interaction.memberPermissions.has('KickMembers')) return interaction.reply({ content: 'You lack permission.', ephemeral: true });
  const id = addInfraction(guild.id, user.id, interaction.user.id, 'warn', reason);
  interaction.reply({ content: `Warned ${user.tag}. (id=${id})` });
}

async function executePrefix(message: any, args: string[]) {
  if (!message.member.permissions.has('KickMembers')) return message.reply('You lack permission.');
  const target = message.mentions.users.first() || (args[0] && { id: args[0], tag: args[0] } as any);
  if (!target) return message.reply('Mention a target.');
  const reason = args.slice(1).join(' ') || 'No reason';
  const id = addInfraction(message.guild!.id, target.id, message.author.id, 'warn', reason);
  message.channel.send(`Warned ${target.tag ?? target.id} (id=${id})`);
}

export = {
  name: 'warn',
  description: 'Warn a member',
  data,
  executeSlash,
  executePrefix
};
