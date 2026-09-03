import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events, Collection } from 'discord.js';
import { createHealthServer } from './health';
import { info, error } from './logger';
import { loadCommands, type Command } from './commands/command-loader';
import { runAutoMod } from './automod/automod';
import { recordJoin } from './anti/raid';
import { recordDestructiveAction } from './anti/nuke';
import { getGuildSettings } from './db/settings';
import db from './db';
import { canUseCommand } from './utils/permissions';
import { applyStatusSettings, clearStatusTimers } from './services/status';
const token = process.env.DISCORD_TOKEN;
const ownerId = process.env.OWNER_ID;
if (!token || !ownerId) throw new Error('DISCORD_TOKEN and OWNER_ID are required');
const client = new Client({ intents: [GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent], partials: [Partials.Channel] });
(client as any).context = { ownerId };
const commands = loadCommands(client) as Collection<string, Command>;
function parsePrefix(content:string,prefix:string){ if(!content.startsWith(prefix))return null; const a=content.slice(prefix.length).trim().split(/\s+/).filter(Boolean); if(!a.length)return null; return {name:(a.shift()||'').toLowerCase(),args:a}; }
async function executeCommand(source:any,command:Command,args:string[]=[]){ const check=canUseCommand(source,command,ownerId!); if(!check.ok)return source.reply({content:check.reason,ephemeral:Boolean(source.isChatInputCommand?.())}); try { if(source.isChatInputCommand?.()) return command.executeSlash ? await command.executeSlash(source) : source.reply({content:'Command is unavailable.',ephemeral:true}); return command.executePrefix ? await command.executePrefix(source,args) : source.reply('Command is unavailable.'); } catch(e){ error('Command execution failed',e instanceof Error?e.message:String(e)); return source.reply({content:'Something went wrong while executing that command.',ephemeral:Boolean(source.isChatInputCommand?.())}).catch(()=>{}); } }
client.once(Events.ClientReady,async ready=>{ info('Logged in as',ready.user.tag); info('Guild count:',ready.guilds.cache.size); await applyStatusSettings(ready).catch(e=>error('Status setup error',e)); });
client.on(Events.MessageCreate,async message=>{ try { if(message.author.bot||!message.guild)return; await runAutoMod(message); const parsed=parsePrefix(message.content,getGuildSettings(message.guild.id).prefix); if(!parsed)return; const command=commands.get(parsed.name); if(command)await executeCommand(message,command,parsed.args); }catch(e){error('Message handler error',e instanceof Error?e.message:String(e));} });
client.on(Events.InteractionCreate,async interaction=>{ try { if(!interaction.isChatInputCommand())return; const command=commands.get(interaction.commandName); if(command)await executeCommand(interaction,command); else await interaction.reply({content:'Unknown command.',ephemeral:true}); }catch(e){error('Interaction handler error',e instanceof Error?e.message:String(e));} });
client.on(Events.GuildMemberAdd,member=>recordJoin(member));
client.on(Events.ChannelDelete,channel=>{if(channel.guild)void recordDestructiveAction(channel.guild,'CHANNEL_DELETE',channel.id);});
client.on(Events.RoleDelete,role=>void recordDestructiveAction(role.guild,'ROLE_DELETE',role.id));
client.on(Events.GuildBanAdd,ban=>void recordDestructiveAction(ban.guild,'BAN',ban.user.id));
process.on('unhandledRejection',e=>error('UnhandledRejection',e));
process.on('uncaughtException',e=>error('UncaughtException',e));
async function start(){ const server=createHealthServer(client); await client.login(token); info('Startup: database ready',db.open); info('Health: /health'); const shutdown=()=>{clearStatusTimers();server.close();client.destroy();db.close();}; process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown); }
void start().catch(e=>{error('Startup failed',e);process.exit(1);});
