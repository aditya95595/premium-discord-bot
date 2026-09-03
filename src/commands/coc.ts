import {SlashCommandBuilder,EmbedBuilder} from 'discord.js';
import {getClan,getPlayer,getCurrentWar,getWarLog,getCwlLeague,cocConfigured} from '../services/coc';

const data=new SlashCommandBuilder().setName('coc').setDescription('Clash of Clans clan tools')
 .addSubcommand(s=>s.setName('clan').setDescription('Show a clan profile').addStringOption(o=>o.setName('tag').setDescription('Clan tag, e.g. #ABC123').setRequired(false)))
 .addSubcommand(s=>s.setName('player').setDescription('Show a player profile').addStringOption(o=>o.setName('tag').setDescription('Player tag').setRequired(true)))
 .addSubcommand(s=>s.setName('war').setDescription('Show the current war').addStringOption(o=>o.setName('tag').setDescription('Clan tag').setRequired(false)))
 .addSubcommand(s=>s.setName('warlog').setDescription('Show recent war results').addStringOption(o=>o.setName('tag').setDescription('Clan tag').setRequired(false)))
 .addSubcommand(s=>s.setName('cwl').setDescription('Show the current CWL group').addStringOption(o=>o.setName('tag').setDescription('Clan tag').setRequired(false)));

const tagFor=(i:any)=>i.options.getString('tag')||process.env.COC_DEFAULT_CLAN_TAG||'';
const fail=(e:any)=>e?.message||'Clash of Clans API request failed.';
const fmtWar=(war:any)=>{
 if(war.state==='notInWar')return new EmbedBuilder().setTitle('⚔️ Current War').setDescription('The clan is not currently in a war.');
 if(war.state==='warEnded')return new EmbedBuilder().setTitle('⚔️ War Ended').addFields({name:'Result',value:war.result||'—',inline:true},{name:'Team size',value:String(war.teamSize||'—'),inline:true});
 const ours=war.clan,opp=war.opponent;return new EmbedBuilder().setTitle(`⚔️ ${ours?.name||'Clan'} vs ${opp?.name||'Opponent'}`).addFields({name:'State',value:String(war.state),inline:true},{name:'Score',value:`${ours?.stars??0} ⭐ — ${opp?.stars??0} ⭐`,inline:true},{name:'Destruction',value:`${(ours?.destructionPercentage??0).toFixed(1)}% — ${(opp?.destructionPercentage??0).toFixed(1)}%`,inline:true});
};
async function executeSlash(i:any){
 if(!cocConfigured())return i.reply({content:'⚠️ CoC API is not configured. Set `COC_API_TOKEN` in the bot environment.',ephemeral:true});
 const sub=i.options.getSubcommand();const tag=tagFor(i);if(!tag&&sub!=='player')return i.reply({content:'Provide a clan tag or configure `COC_DEFAULT_CLAN_TAG`.',ephemeral:true});
 await i.deferReply();try{
  if(sub==='clan'){const c=await getClan(tag);const e=new EmbedBuilder().setTitle(`🏰 ${c.name}`).setDescription(`${c.tag} • Level ${c.clanLevel}`).setThumbnail(c.badgeUrls?.medium||'').addFields({name:'Members',value:`${c.members}/50`,inline:true},{name:'War League',value:c.warLeague?.name||'—',inline:true},{name:'War Wins',value:String(c.warWins??0),inline:true},{name:'Capital League',value:c.capitalLeague?.name||'—',inline:true},{name:'Capital Points',value:String(c.clanCapitalPoints??0),inline:true});return i.editReply({embeds:[e]});}
  if(sub==='player'){const p=await getPlayer(i.options.getString('tag'));const e=new EmbedBuilder().setTitle(`👤 ${p.name}`).setDescription(`${p.tag} • TH${p.townHallLevel}`).addFields({name:'Trophies',value:String(p.trophies??0),inline:true},{name:'Best',value:String(p.bestTrophies??0),inline:true},{name:'War Stars',value:String(p.warStars??0),inline:true},{name:'Clan',value:p.clan?`${p.clan.name} (${p.clan.tag})`:'No clan',inline:false});return i.editReply({embeds:[e]});}
  if(sub==='war')return i.editReply({embeds:[fmtWar(await getCurrentWar(tag))]});
  if(sub==='warlog'){const w=await getWarLog(tag);const rows=(w.items||[]).slice(0,5).map((x:any)=>`${x.result==='win'?'🟢':x.result==='lose'?'🔴':'⚪'} ${x.clan?.name||'Clan'} vs ${x.opponent?.name||'Opponent'} • ${x.clan?.stars??0}-${x.opponent?.stars??0}`).join('\n')||'No war history available.';return i.editReply({embeds:[new EmbedBuilder().setTitle('📜 Recent War Log').setDescription(rows)]});}
  const group=await getCwlLeague(tag);const clans=(group.clans||[]).map((c:any)=>`${c.tag} • ${c.name} • TH${c.clanLevel??'?'}`).join('\n')||'No CWL group available.';return i.editReply({embeds:[new EmbedBuilder().setTitle(`🏆 CWL Group • ${group.season||'Current'}`).setDescription(clans).setFooter({text:'Use /coc war for the live war when available.'})]});
 }catch(e){return i.editReply({content:`❌ ${fail(e)}`});}
}
export={name:'coc',description:'Clash of Clans clan tools',data,executeSlash};
