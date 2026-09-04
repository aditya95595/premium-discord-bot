import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { COLORS } from '../utils/embeds';

const data = new SlashCommandBuilder().setName('help').setDescription('Open the premium command center');

function buildPages(source:any) {
  const all = [...source.client.commands.values()].filter((c:any) => c.data);
  const groups: Record<string, any[]> = {
    '🛡️ Moderation': all.filter((c:any) => ['ban','kick','timeout','warn','warnings','clear','lock','unlock','history'].includes(c.name)),
    '🔐 Security & Config': all.filter((c:any) => ['security','config','command-permission','prefix','status'].includes(c.name)),
    '🔧 Utility': all.filter((c:any) => !['ban','kick','timeout','warn','warnings','clear','lock','unlock','history','security','config','command-permission','prefix','status'].includes(c.name))
  };
  const entries = Object.entries(groups).filter(([, commands]) => commands.length);
  const pages: EmbedBuilder[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const embed = new EmbedBuilder().setColor(COLORS.primary).setTitle('✦ Premium Command Center').setDescription('Fast, clean access to every command available in this server.\n\nUse `/command` or your configured prefix.').setTimestamp();
    for (const [name, commands] of entries.slice(i, i + 2)) embed.addFields({name, value:commands.map((c:any)=>`**/${c.name}** — ${c.description}`).join('\n').slice(0,1024)});
    embed.setFooter({text:`Premium Bot • Page ${Math.floor(i/2)+1}/${Math.ceil(entries.length/2)} • ${all.length} commands`});
    pages.push(embed);
  }
  if (!pages.length) pages.push(new EmbedBuilder().setColor(COLORS.warning).setTitle('✦ Command Center').setDescription('No commands are currently available.').setTimestamp().setFooter({text:'Premium Bot'}));
  return pages;
}

async function executeSlash(i:any) {
  const pages=buildPages(i); const row=pages.length>1?new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('help_prev').setLabel('Previous').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('help_next').setLabel('Next').setStyle(ButtonStyle.Primary)):undefined;
  let page=0; const message=await i.reply({embeds:[pages[0]],components:row?[row]:[],ephemeral:true,fetchReply:true}); if(!row)return message;
  const collector=message.createMessageComponentCollector({time:120000});
  collector.on('collect',async(button:any)=>{if(button.user.id!==i.user.id)return button.reply({content:'This help menu belongs to the command user.',ephemeral:true});page=button.customId==='help_next'?(page+1)%pages.length:(page-1+pages.length)%pages.length;await button.update({embeds:[pages[page]],components:[row]});});
  collector.on('end',async()=>{await i.editReply({components:[]}).catch(()=>{});}); return message;
}

async function executePrefix(m:any){return m.reply({embeds:[buildPages(m)[0]]});}
export={name:'help',description:'Open the premium command center',data,executeSlash,executePrefix,cooldown:5};
