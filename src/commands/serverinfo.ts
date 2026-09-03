import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
const data=new SlashCommandBuilder().setName('serverinfo').setDescription('Show server information');
async function run(s:any){return new EmbedBuilder().setTitle(s.guild.name).setThumbnail(s.guild.iconURL({size:256})||'').addFields({name:'Owner',value:`<@${s.guild.ownerId}>`,inline:true},{name:'Members',value:String(s.guild.memberCount),inline:true},{name:'Channels',value:String(s.guild.channels.cache.size),inline:true},{name:'Roles',value:String(s.guild.roles.cache.size),inline:true},{name:'Created',value:`<t:${Math.floor(s.guild.createdTimestamp/1000)}:D>`,inline:true});}
async function executeSlash(i:any){return i.reply({embeds:[await run(i)]});} async function executePrefix(m:any){return m.reply({embeds:[await run(m)]});}
export={name:'serverinfo',description:'Show server information',data,executeSlash,executePrefix};
