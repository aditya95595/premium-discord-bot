import { Message } from 'discord.js';
import { getGuildSettings } from '../db/settings';
import { addInfraction } from '../db/infractions';
import { warn as logWarn } from '../logger';

// simple profanity list - for extension use file/db
const PROFANITY = ['badword1', 'badword2', 'badword3'];
const LINK_REGEX = /(https?:\/\/[^\s]+)/i;

export async function runAutoMod(message: Message) {
  if (!message.guild || message.author.bot) return;
  const settings = getGuildSettings(message.guild.id);
  if (!settings.automod_enabled) return;
  const content = message.content ?? '';
  // profanity
  if (settings.automod_profanity) {
    for (const bad of PROFANITY) {
      if (content.toLowerCase().includes(bad)) {
        await message.delete().catch(() => {});
        addInfraction(message.guild.id, message.author.id, null, 'automod-profanity', bad);
        logWarn('Automod removed profanity message', { guild: message.guild.id, user: message.author.id });
        return;
      }
    }
  }
  // links
  if (settings.automod_links && LINK_REGEX.test(content)) {
    await message.delete().catch(() => {});
    addInfraction(message.guild.id, message.author.id, null, 'automod-link', 'link');
    return;
  }
  // caps ratio
  if (settings.automod_caps) {
    const letters = content.replace(/[^A-Za-z]/g, '');
    if (letters.length >= 5) {
      const caps = letters.split('').filter(c => c === c.toUpperCase()).length;
      if (caps / letters.length > 0.8) {
        await message.delete().catch(() => {});
        addInfraction(message.guild.id, message.author.id, null, 'automod-caps', 'caps');
        return;
      }
    }
  }
}
