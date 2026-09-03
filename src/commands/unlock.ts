import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { PermissionFlagsBits as P } from 'discord.js';
const data=new SlashCommandBuilder().setName('unlock').setDescription('Unlock this channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);
async function run(s:any){if(!s.channel?.isTextBased()||!('permissionOverwrites' in s.channel))throw new Error('Text channel required.');if(!s.channel.permissionsFor(s.guild.members.me)?.has(P.ManageChannels))throw new Error('I need Manage Channels permission.');await s.channel.permissionOverwrites.edit(s.guild.roles.everyone,{SendMessages:null});return '🔓 Channel unlocked.';}
async function executeSlash(i:any){try{return i.reply(await run(i));}catch(e){return i.reply({content:e instanceof Error?e.message:'Unlock failed.',ephemeral:true});}}
async function executePrefix(m:any){try{return m.reply(await run(m));}catch(e){return m.reply(e instanceof Error?e.message:'Unlock failed.');}}
export={name:'unlock',description:'Unlock this channel',permissions:['ManageChannels'],data,executeSlash,executePrefix};
