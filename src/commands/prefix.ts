import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings, setGuildSetting } from '../db/settings';
import { isIdLike } from '../utils/validation';

const data = new SlashCommandBuilder()
  .setName('prefix')
  .setDescription('Get or set the command prefix (admin only)')
  .addStringOption(o => o.setName('value').setDescription('New prefix'));

async function executeSlash(interaction: any) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Guild only.', ephemeral: true });
  if (!interaction.memberPermissions.has('ManageGuild')) return interaction.reply({ content: 'Manage Server required.', ephemeral: true });
  const value = interaction.options.getString('value');
  if (!value) {
    const s = getGuildSettings(guild.id);
    return interaction.reply({ content: `Prefix for this guild is \`${s.prefix}\``, ephemeral: true });
  }
  if (value.length > 5) return interaction.reply({ content: 'Prefix too long (max 5 chars).', ephemeral: true });
  setGuildSetting(guild.id, 'prefix', value);
  return interaction.reply({ content: `Prefix set to \`${value}\``, ephemeral: true });
}

async function executePrefix(message: any, args: string[]) {
  if (!message.member.permissions.has('ManageGuild')) return message.reply('Manage Server required.');
  const val = args[0];
  if (!val) {
    const s = getGuildSettings(message.guild!.id);
    return message.reply(`Prefix for this guild is \`${s.prefix}\``);
  }
  if (val.length > 5) return message.reply('Prefix too long (max 5).');
  setGuildSetting(message.guild!.id, 'prefix', val);
  message.channel.send(`Prefix set to \`${val}\``);
}

export = {
  name: 'prefix',
  description: 'Get or set prefix',
  data,
  executeSlash,
  executePrefix
};
