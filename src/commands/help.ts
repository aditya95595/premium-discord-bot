import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
const data=new SlashCommandBuilder().setName('help').setDescription('Show available commands');
async function run(s:any){const cmds=[...s.client.commands.values()].filter((c:any)=>c.data);const text=cmds.map((c:any)=>`**/${c.name}** — ${c.description}`).join('\n');return new EmbedBuilder().setTitle('Command Center').setDescription(text||'No commands loaded.').setFooter({text:'Prefix commands use your server prefix.'});}
async function executeSlash(i:any){return i.reply({embeds:[run(i)],ephemeral:true});}
async function executePrefix(m:any){return m.reply({embeds:[run(m)]});}
export={name:'help',description:'Show available commands',cooldown:5,data,executeSlash,executePrefix};
