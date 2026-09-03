import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
const data=new SlashCommandBuilder().setName('userinfo').setDescription('Show user information').addUserOption(o=>o.setName('user').setDescription('User'));
async function run(s:any,u:any){const m=s.guild.members.cache.get(u.id)||await s.guild.members.fetch(u.id).catch(()=>null);const e=new EmbedBuilder().setTitle(u.tag).setThumbnail(u.displayAvatarURL({size:256})).addFields({name:'User ID',value:u.id,inline:true},{name:'Joined',value:m?.joinedTimestamp?`<t:${Math.floor(m.joinedTimestamp/1000)}:R>`:'Unknown',inline:true},{name:'Created',value:`<t:${Math.floor(u.createdTimestamp/1000)}:R>`,inline:true});return e;}
async function executeSlash(i:any){return i.reply({embeds:[await run(i,i.options.getUser('user')||i.user)]});}
async function executePrefix(m:any,args:string[]){const id=args[0]?.replace(/[<@!>]/g,'');const u=id?await m.client.users.fetch(id).catch(()=>null):m.author;if(!u)return m.reply('User not found.');return m.reply({embeds:[await run(m,u)]});}
export={name:'userinfo',description:'Show user information',data,executeSlash,executePrefix};
