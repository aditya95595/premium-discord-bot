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
import { startReminderService, stopReminderService } from './services/reminders';
import { startTemporaryPunishmentService, stopTemporaryPunishmentService } from './services/temp-punishments';
const token=process.env.DISCORD_TOKEN,ownerId=process.env.OWNER_ID;
if(!token||!ownerId)throw new Error('DISCORD_TOKEN and OWNER_ID are required');
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent],partials:[Partials.Channel]});
(client as any).context={ownerId};
const commands=loadCommands(client) as Collection<string,Command>;
const cooldowns=new Map<string,number>();
function parsePrefix(content:string,prefix:string){if(!content.startsWith(prefix))return null;const body=content.slice(prefix.length).trim();if(!body)return null;const args=body.match(/(?:[^\s"]+|"(?:\\.|[^"\\])*")+/g)??[];const name=(args.shift()??'').toLowerCase();return{name,args:args.map(x=>x.replace(/^"|"$/g,''))};}
function cooldownLeft(source:any,command:Command){const seconds=command.cooldown??2;if(!source.guild||seconds<=0)return 0;const key=`${source.guild.id}:${source.user?.id??source.author?.id}:${command.name}`,now=Date.now(),last=cooldowns.get(key)??0;if(now-last<seconds*1000)return Math.ceil((seconds*1000-now+last)/1000);cooldowns.set(key,now);return 0;}
setInterval(()=>{const cutoff=Date.now()-900000;for(const[k,v]of cooldowns)if(v<cutoff)cooldowns.delete(k);},300000).unref();
async function executeCommand(source:any,command:Command,args:string[]=[]){const check=canUseCommand(source,command,ownerId!);const ephemeral=Boolean(source.isChatInputCommand?.());if(!check.ok)return source.reply({content:check.reason,ephemeral});const remaining=cooldownLeft(source,command);if(remaining)return source.reply({content:`Please wait ${remaining}s before using this command again.`,ephemeral});try{if(source.isChatInputCommand?.())return command.executeSlash?await command.executeSlash(source):source.reply({content:'This command is not available as a slash command.',ephemeral:true});return command.executePrefix?await command.executePrefix(source,args):source.reply('This command is not available with the prefix.');}catch(e){error(`Command ${command.name} failed`,e instanceof Error?e.message:String(e));return source.reply({content:'An unexpected error occurred while executing the command.',ephemeral}).catch(()=>{});}}
client.once(Events.ClientReady,async ready=>{info(`Logged in as ${ready.user.tag}`);info(`Guild count: ${ready.guilds.cache.size}`);startReminderService(ready);startTemporaryPunishmentService(ready);await applyStatusSettings(ready).catch(e=>error('Status setup error',e));});
client.on(Events.MessageCreate,async message=>{try{if(message.author.bot||!message.guild)return;await runAutoMod(message);const parsed=parsePrefix(message.content,getGuildSettings(message.guild.id).prefix||'!');if(!parsed)return;const command=commands.get(parsed.name);if(command)await executeCommand(message,command,parsed.args);}catch(e){error('Message handler error',e instanceof Error?e.message:String(e));}});
client.on(Events.InteractionCreate,async interaction=>{try{if(!interaction.isChatInputCommand())return;const command=commands.get(interaction.commandName.toLowerCase());if(!command)return interaction.reply({content:'Unknown command.',ephemeral:true});await executeCommand(interaction,command);}catch(e){error('Interaction handler error',e instanceof Error?e.message:String(e));if(!interaction.replied&&!interaction.deferred)await interaction.reply({content:'An unexpected error occurred.',ephemeral:true}).catch(()=>{});}});
client.on(Events.GuildMemberAdd,member=>void recordJoin(member));
client.on(Events.ChannelDelete,channel=>{if(channel.guild)void recordDestructiveAction(channel.guild,'CHANNEL_DELETE',channel.id);});
client.on(Events.GuildRoleDelete,role=>void recordDestructiveAction(role.guild,'ROLE_DELETE',role.id));
client.on(Events.GuildBanAdd,ban=>void recordDestructiveAction(ban.guild,'BAN',ban.user.id));
process.on('unhandledRejection',e=>error('UnhandledRejection',e));process.on('uncaughtException',e=>error('UncaughtException',e));
async function start(){const server=createHealthServer(client);await client.login(token);info('Startup: database ready');info(`Health: /health on port ${process.env.PORT||3000}`);info(`Discord: ${client.user?.tag||'unknown'}`);info(`Guilds: ${client.guilds.cache.size}`);const shutdown=()=>{stopReminderService();stopTemporaryPunishmentService();clearStatusTimers();server.close();client.destroy();db.close();};process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);}
void start().catch(e=>{error('Startup failed',e);process.exit(1);});
