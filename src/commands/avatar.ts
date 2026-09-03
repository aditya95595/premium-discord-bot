import { SlashCommandBuilder } from 'discord.js';
const data=new SlashCommandBuilder().setName('avatar').setDescription('Show a user avatar').addUserOption(o=>o.setName('user').setDescription('User'));
async function run(s:any,u:any){return u.displayAvatarURL({size:1024,extension:'png'});}
async function executeSlash(i:any){return i.reply(await run(i,i.options.getUser('user')||i.user));} async function executePrefix(m:any,args:string[]){const id=args[0]?.replace(/[<@!>]/g,'');const u=id?await m.client.users.fetch(id).catch(()=>null):m.author;if(!u)return m.reply('User not found.');return m.reply(await run(m,u));}
export={name:'avatar',description:'Show a user avatar',data,executeSlash,executePrefix};
