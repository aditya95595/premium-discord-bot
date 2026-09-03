import { SlashCommandBuilder } from 'discord.js';
const data=new SlashCommandBuilder().setName('poll').setDescription('Create a simple poll').addStringOption(o=>o.setName('question').setDescription('Question').setRequired(true));
async function run(s:any,q:string){if(!s.channel?.isTextBased())throw new Error('Text channel required.');const msg=await s.channel.send(`📊 **Poll**\n${q}\n\n👍 Yes  |  👎 No`);await msg.react('👍');await msg.react('👎');return 'Poll created.';}
async function executeSlash(i:any){try{return i.reply({content:await run(i,i.options.getString('question',true)),ephemeral:true});}catch(e){return i.reply({content:e instanceof Error?e.message:'Poll failed.',ephemeral:true});}}
async function executePrefix(m:any,args:string[]){if(!args.length)return m.reply('Usage: !poll <question>');try{return m.reply(await run(m,args.join(' ')));}catch(e){return m.reply(e instanceof Error?e.message:'Poll failed.');}}
export={name:'poll',description:'Create a simple poll',data,executeSlash,executePrefix};
