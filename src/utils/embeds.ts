import { EmbedBuilder, type ColorResolvable } from 'discord.js';

const BRAND = 'Premium Bot';

export const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  neutral: 0x2b2d31,
  info: 0x3498db
} as const;

export function brandEmbed(options: ConstructorParameters<typeof EmbedBuilder>[0] = {}) {
  const embed = new EmbedBuilder(options)
    .setColor(COLORS.primary)
    .setTimestamp();

  if (!embed.data.footer) embed.setFooter({ text: BRAND });
  return embed;
}

export function textEmbed(content: string, title = 'Message', color: ColorResolvable = COLORS.primary) {
  return brandEmbed().setColor(color).setTitle(title).setDescription(content);
}

export function successEmbed(content: string, title = 'Success') {
  return textEmbed(content, title, COLORS.success);
}

export function errorEmbed(content: string, title = 'Something went wrong') {
  return textEmbed(content, title, COLORS.danger);
}

export function warningEmbed(content: string, title = 'Warning') {
  return textEmbed(content, title, COLORS.warning);
}

export function infoEmbed(content: string, title = 'Information') {
  return textEmbed(content, title, COLORS.info);
}

export function normalizeReply(value: any, fallbackTitle = 'Premium Bot') {
  if (typeof value === 'string') return { embeds: [textEmbed(value, fallbackTitle)] };
  if (!value || typeof value !== 'object') return value;
  if (typeof value.content === 'string' && !value.embeds?.length) {
    const text = value.content.trim();
    let color: ColorResolvable = COLORS.primary;
    let title = fallbackTitle;
    if (/^(error|failed|unable|cannot|can't|invalid|not found|missing)/i.test(text)) {
      color = COLORS.danger;
      title = 'Action failed';
    } else if (/^(success|done|completed|enabled|disabled|updated|created|deleted)/i.test(text)) {
      color = COLORS.success;
      title = 'Action completed';
    }
    return { ...value, embeds: [textEmbed(text, title, color)], content: undefined };
  }
  return value;
}

export function decorateEmbed(embed: EmbedBuilder) {
  if (!embed.data.color) embed.setColor(COLORS.primary);
  if (!embed.data.timestamp) embed.setTimestamp();
  if (!embed.data.footer) embed.setFooter({ text: BRAND });
  return embed;
}
