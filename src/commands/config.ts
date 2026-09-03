import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildSettings, setGuildSetting } from '../db/settings';

const data = new SlashCommandBuilder()
  .setName('config').setDescription('Configure this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o => o.setName('key').setDescription('Setting').setRequired(true).addChoices(
    {name:'prefix',value:'prefix'},{name:'mod-log',value:'mod_log_channel'},{name:'staff-roles',value:'staff_roles'},
    {name:'automod',value:'automod_enabled'},{name:'profanity',value:'automod_profanity'},{name:'links',value:'automod_links'},
    {name:'invites',value:'automod_invites'},{name:'caps',value:'automod_caps'},{name:'spam-threshold',value:'automod_spam_threshold'},
    {name:'mention-limit',value:'automod_mention_limit'},{name:'blocked-words',value:'automod_blocked_words'},
    {name:'automod-punishment',value:'automod_punishment'},{name:'raid-mode',value:'raid_mode'},{name:'raid-threshold',value:'raid_threshold'},
  ))
  .addStringOption(o => o.setName('value').setDescription('New value').setRequired(false));
const boolKeys = new Set(['automod_enabled','automod_profanity','automod_links','automod_invites','automod_caps','raid_mode']);
const ranges: Record<string,[number,number]> = {automod_spam_threshold:[3,20],automod_mention_limit:[2,20],raid_threshold:[3,50]};
const punishments = new Set(['delete','timeout','ban']);

async function run(s:any, key:string, value:string|null) {
  if (!s.member.permissions.has(PermissionFlagsBits.ManageGuild) && !s.member.permissions.has(PermissionFlagsBits.Administrator)) throw new Error('Manage Server permission is required.');
  const current:any = getGuildSettings(s.guild.id);
  if (value === null) return `${key}: ${String(current[key])}`;
  if (key === 'prefix' && (value.length > 5 || /\s/.test(value) || !value.length)) throw new Error('Prefix must be 1–5 non-space characters.');
  if (key === 'mod_log_channel' && !/^\d{15,25}$/.test(value)) throw new Error('Use a valid channel ID.');
  if (key === 'staff_roles' && value && !value.split(',').every(x => /^\d{15,25}$/.test(x.trim()))) throw new Error('Use comma-separated role IDs.');
  if (key === 'automod_blocked_words' && value.length > 2000) throw new Error('Blocked words list is too long.');
  if (key === 'automod_punishment' && !punishments.has(value.toLowerCase())) throw new Error('AutoMod punishment must be **delete**, **timeout**, or **ban**.');
  if (boolKeys.has(key) && value !== '0' && value !== '1') throw new Error('This setting accepts 0 or 1.');
  if (ranges[key]) { const n = Number(value); if (!Number.isInteger(n) || n < ranges[key][0] || n > ranges[key][1]) throw new Error(`Value must be between ${ranges[key][0]} and ${ranges[key][1]}.`); }
  setGuildSetting(s.guild.id, key as any, (boolKeys.has(key) || ranges[key]) ? Number(value) : value);
  return `Updated **${key}** to **${value}**.`;
}

async function executeSlash(i:any) { try { return i.reply({content:await run(i,i.options.getString('key',true),i.options.getString('value')),ephemeral:true}); } catch(e) { return i.reply({content:e instanceof Error?e.message:'Invalid configuration.',ephemeral:true}); } }
async function executePrefix(m:any,args:string[]) {
  const prefix = getGuildSettings(m.guild.id).prefix || '!';
  if (!args[0]) return m.reply(`Usage: ${prefix}config <key> <value>.`);
  try { return m.reply(await run(m,args[0],args[1]??null)); } catch(e) { return m.reply(e instanceof Error?e.message:'Invalid configuration.'); }
}
export default {name:'config',description:'Configure this server',adminOnly:true,permissions:['ManageGuild'],data,executeSlash,executePrefix};
