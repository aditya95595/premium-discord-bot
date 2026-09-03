import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getClan, getPlayer, getCurrentWar, getWarLog, getCwlLeague, cocConfigured } from '../services/coc';

const data = new SlashCommandBuilder()
  .setName('coc')
  .setDescription('Clash of Clans tools for clan leaders, members, wars, CWL, and recruitment.')
  .addSubcommand(s => s.setName('clan').setDescription('View a clan profile including members, level, war league, wins, and Capital information.').addStringOption(o => o.setName('tag').setDescription('Optional clan tag such as #ABC123; uses the configured server clan when omitted.').setRequired(false)))
  .addSubcommand(s => s.setName('player').setDescription('View a player profile including Town Hall, trophies, war stars, heroes, and current clan.').addStringOption(o => o.setName('tag').setDescription('Player tag such as #ABC123.').setRequired(true)))
  .addSubcommand(s => s.setName('war').setDescription('View the current clan war, including state, score, and destruction percentages.').addStringOption(o => o.setName('tag').setDescription('Optional clan tag; uses the configured server clan when omitted.').setRequired(false)))
  .addSubcommand(s => s.setName('warlog').setDescription('View the latest completed clan wars and their win, loss, or draw results.').addStringOption(o => o.setName('tag').setDescription('Optional clan tag; uses the configured server clan when omitted.').setRequired(false)))
  .addSubcommand(s => s.setName('cwl').setDescription('View the current Clan War League group and participating clans for the configured clan.').addStringOption(o => o.setName('tag').setDescription('Optional clan tag; uses the configured server clan when omitted.').setRequired(false)))
  .addSubcommand(s => s.setName('members').setDescription('View the clan roster with member names, Town Hall levels, and trophies.').addStringOption(o => o.setName('tag').setDescription('Optional clan tag; uses the configured server clan when omitted.').setRequired(false)))
  .addSubcommand(s => s.setName('recruit').setDescription('Evaluate a player for recruitment using Town Hall, hero levels, trophies, and war-star signals.').addStringOption(o => o.setName('tag').setDescription('Player tag to evaluate, such as #ABC123.').setRequired(true)));

const tagFor = (i: any) => i.options.getString('tag') || process.env.COC_DEFAULT_CLAN_TAG || '';
const fail = (e: any) => e?.message || 'Clash of Clans API request failed.';
const fmtWar = (war: any) => {
  if (war.state === 'notInWar') return new EmbedBuilder().setTitle('⚔️ Current War').setDescription('The clan is not currently in a war.');
  if (war.state === 'warEnded') return new EmbedBuilder().setTitle('⚔️ War Ended').addFields({ name: 'Result', value: war.result || '—', inline: true }, { name: 'Team size', value: String(war.teamSize || '—'), inline: true });
  const ours = war.clan, opp = war.opponent;
  return new EmbedBuilder().setTitle(`⚔️ ${ours?.name || 'Clan'} vs ${opp?.name || 'Opponent'}`).addFields({ name: 'State', value: String(war.state), inline: true }, { name: 'Score', value: `${ours?.stars ?? 0} ⭐ — ${opp?.stars ?? 0} ⭐`, inline: true }, { name: 'Destruction', value: `${(ours?.destructionPercentage ?? 0).toFixed(1)}% — ${(opp?.destructionPercentage ?? 0).toFixed(1)}%`, inline: true });
};
function heroSummary(p: any) { return (p.heroes || []).filter((h: any) => h.village === 'home').map((h: any) => `${h.name}: ${h.level}`).join(' • ') || 'Hero data unavailable'; }

async function executeSlash(i: any) {
  if (!cocConfigured()) return i.reply({ content: '⚠️ CoC API is not configured. Set `COC_API_TOKEN` in the bot environment.', ephemeral: true });
  const sub = i.options.getSubcommand(); const tag = tagFor(i);
  if (!tag && sub !== 'player' && sub !== 'recruit') return i.reply({ content: 'Provide a clan tag or configure `COC_DEFAULT_CLAN_TAG`.', ephemeral: true });
  await i.deferReply();
  try {
    if (sub === 'clan') { const c = await getClan(tag); const e = new EmbedBuilder().setTitle(`🏰 ${c.name}`).setDescription(`${c.tag} • Level ${c.clanLevel}`).setThumbnail(c.badgeUrls?.medium || '').addFields({ name: 'Members', value: `${c.members}/50`, inline: true }, { name: 'War League', value: c.warLeague?.name || '—', inline: true }, { name: 'War Wins', value: String(c.warWins ?? 0), inline: true }, { name: 'Capital League', value: c.capitalLeague?.name || '—', inline: true }, { name: 'Capital Points', value: String(c.clanCapitalPoints ?? 0), inline: true }); return i.editReply({ embeds: [e] }); }
    if (sub === 'player' || sub === 'recruit') { const p = await getPlayer(i.options.getString('tag')); if (sub === 'player') { const e = new EmbedBuilder().setTitle(`👤 ${p.name}`).setDescription(`${p.tag} • TH${p.townHallLevel}`).addFields({ name: 'Trophies', value: String(p.trophies ?? 0), inline: true }, { name: 'Best', value: String(p.bestTrophies ?? 0), inline: true }, { name: 'War Stars', value: String(p.warStars ?? 0), inline: true }, { name: 'Heroes', value: heroSummary(p), inline: false }, { name: 'Clan', value: p.clan ? `${p.clan.name} (${p.clan.tag})` : 'No clan', inline: false }); return i.editReply({ embeds: [e] }); } const th = Number(p.townHallLevel || 0), heroes = (p.heroes || []).filter((h: any) => h.village === 'home'), heroLevels = heroes.reduce((n: number, h: any) => n + Number(h.level || 0), 0), score = Math.min(100, Math.round(th * 4 + heroLevels * .45 + Math.min(20, Number(p.warStars || 0) / 50))); const verdict = score >= 75 ? '🟢 Excellent' : score >= 55 ? '🟡 Review' : '🔴 Weak'; const e = new EmbedBuilder().setTitle(`🔎 Recruitment Check • ${p.name}`).setDescription(`${verdict} • Score **${score}/100**`).addFields({ name: 'Town Hall', value: `TH${th}`, inline: true }, { name: 'Trophies', value: String(p.trophies ?? 0), inline: true }, { name: 'Hero levels', value: String(heroLevels), inline: true }, { name: 'War stars', value: String(p.warStars ?? 0), inline: true }, { name: 'Recommendation', value: score >= 75 ? 'Strong candidate' : score >= 55 ? 'Review war activity and upgrades' : 'Below typical competitive threshold', inline: false }); return i.editReply({ embeds: [e] }); }
    if (sub === 'war') return i.editReply({ embeds: [fmtWar(await getCurrentWar(tag))] });
    if (sub === 'warlog') { const w = await getWarLog(tag); const rows = (w.items || []).slice(0, 5).map((x: any) => `${x.result === 'win' ? '🟢' : x.result === 'lose' ? '🔴' : '⚪'} ${x.clan?.name || 'Clan'} vs ${x.opponent?.name || 'Opponent'} • ${x.clan?.stars ?? 0}-${x.opponent?.stars ?? 0}`).join('\n') || 'No war history available.'; return i.editReply({ embeds: [new EmbedBuilder().setTitle('📜 Recent War Log').setDescription(rows)] }); }
    if (sub === 'members') { const c = await getClan(tag); const rows = (c.memberList || []).slice(0, 25).map((m: any) => `**TH${m.townHallLevel}** ${m.name} • ${m.trophies ?? 0} 🏆`).join('\n') || 'No members returned.'; return i.editReply({ embeds: [new EmbedBuilder().setTitle(`👥 ${c.name} Roster`).setDescription(rows).setFooter({ text: `${c.members}/50 members • showing up to 25` })] }); }
    const group = await getCwlLeague(tag); const clans = (group.clans || []).map((c: any) => `${c.tag} • ${c.name} • Level ${c.clanLevel ?? '?'}`).join('\n') || 'No CWL group available.'; return i.editReply({ embeds: [new EmbedBuilder().setTitle(`🏆 CWL Group • ${group.season || 'Current'}`).setDescription(clans).setFooter({ text: 'Use /coc war for the live war when available.' })] });
  } catch (e) { return i.editReply({ content: `❌ ${fail(e)}` }); }
}

export = { name: 'coc', description: 'Clash of Clans tools for clan leaders, members, wars, CWL, and recruitment.', data, executeSlash };
