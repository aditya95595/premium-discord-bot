import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
async function change(s:any,locked:boolean){if(!s.channel?.isTextBased()||!('permissionOverwrites' in s.channel))throw new Error('Text channel required.');if(!s.channel.permissionsFor(s.guild.members.me)?.has(PermissionFlagsBits.ManageChannels))throw new Error('I need Manage Channels permission.');await s.channel.permissionOverwrites.edit(s.guild.roles.everyone,{SendMessages:locked?false:null});return locked?'🔒 Channel locked.':'🔓 Channel unlocked.';}
const data=new SlashCommandBuilder().setName('lock').setDescription('Lock this channel').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);
async function executeSlash(i:any){try{return i.reply(await change(i,true));}catch(e){return i.reply({content:e instanceof Error?e.message:'Lock failed.',ephemeral:true});}}
async function executePrefix(m:any){try{return m.reply(await change(m,true));}catch(e){return m.reply(e instanceof Error?e.message:'Lock failed.');}}
export={name:'lock',description:'Lock this channel',permissions:['ManageChannels'],data,executeSlash,executePrefix};
