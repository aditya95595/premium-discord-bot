import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events, Collection } from 'discord.js';
import { createHealthServer } from './health';
import { info, error } from './logger';
import { loadCommands, type Command } from './commands/command-loader';
import { runAutoMod } from './automod/automod';
import { recordJoin } from './anti/raid';
import { recordDestructiveAction, confirmKick, isChannelPermissionEscalation, isRolePermissionEscalation } from './anti/nuke';
import { getGuildSettings } from './db/settings';
import db from './db';
import { canUseCommand } from './utils/permissions';
import { applyStatusSettings, clearStatusTimers } from './services/status';
import { startReminderService, stopReminderService } from './services/reminders';
import { startTemporaryPunishmentService, stopTemporaryPunishmentService } from './services/temp-punishments';

const token = process.env.DISCORD_TOKEN, ownerId = process.env.OWNER_ID;
if (!token || !ownerId) throw new Error('DISCORD_TOKEN and OWNER_ID are required');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], partials: [Partials.Channel] });
(client as any).context = { ownerId };
const commands = loadCommands(client) as Collection<string, Command>;
const cooldowns = new Map<string, number>();
let shuttingDown = false;
let shutdown: (() => void) | undefined;

function parsePrefix(content:string,prefix:string){if(!content.startsWith(prefix))return null;const body=content.slice(prefix.length).trim();if(!body)return null;const args=body.match(/(?:[^\s"]+|"(?:\\.|[^"\\])*")+/g)??[];const name=(args.shift()??'').toLowerCase();return{name,args:args.map(x=>x.replace(/^"|"$/g,''))};}
function cooldownLeft(source:any,command:Command){const seconds=command.cooldown??2;if(!source.guild||seconds<=0)return 0;const key=`${source.guild.id}:${source.user?.id??source.author?.id}:${command.name}`,now=Date.now(),last=cooldowns.get(key)??0;if(now-last<seconds*1000)return Math.ceil((seconds*1000-now+last)/1000);cooldowns.set(key,now);return 0;}
setInterval(()=>{const cutoff=Date.now()-900000;for(const[k,v]of cooldowns)if(v<cutoff)cooldowns.delete(k)},300000).unref();

async function executeCommand(source:any,command:Command,args:string[]=[]){
  const check=canUseCommand(source,command,ownerId!);
  const slash=Boolean(source.isChatInputCommand?.());
  const ephemeral=slash;
  if(!check.ok)return source.reply({content:check.reason,ephemeral});
  const remaining=cooldownLeft(source,command);
  if(remaining)return source.reply({content:`Please wait ${remaining}s before using this command again.`,ephemeral});
  try{
    if(slash){
      if(!command.executeSlash)return source.reply({content:'This command is not available as a slash command.',ephemeral:true});
      // Sensitive slash commands are always private, including their success, validation and usage responses.
      if(command.sensitive){
        const originalReply=source.reply.bind(source);
        source.reply=(options:any)=>originalReply(typeof options==='string'?{content:options,ephemeral:true}:{...options,ephemeral:true});
      }
      return await command.executeSlash(source);
    }
    if(!command.executePrefix)return source.reply('This command is not available with the prefix.');
    // Prefix commands cannot use Discord's ephemeral flag. For sensitive commands, remove the public
    // invocation and automatically remove the bot response shortly after so admin/config data is not left in chat.
    if(command.sensitive)await source.delete().catch(()=>{});
    const response=await command.executePrefix(source,args);
    if(command.sensitive&&response?.delete)void response.delete().catch(()=>{});
    return response;
  }catch(e){
    error(`Command ${command.name} failed`,e instanceof Error?e.message:String(e));
    return source.reply({content:'An unexpected error occurred while executing this command.',ephemeral}).catch(()=>{});
  }
}

client.once(Events.ClientReady,async ready=>{info(`Logged in as ${ready.user.tag}`);info(`Guild count: ${ready.guilds.cache.size}`);startReminderService(ready);startTemporaryPunishmentService(ready);await applyStatusSettings(ready).catch(e=>error('Status setup error',e));});
client.on(Events.Error,e=>error('Discord client error',e));
client.on(Events.ShardError,e=>error('Discord shard error',e));
client.on(Events.MessageCreate,async message=>{try{if(message.author.bot||!message.guild)return;const prefix=getGuildSettings(message.guild.id).prefix||'!';const parsed=parsePrefix(message.content,prefix);if(parsed){const command=commands.get(parsed.name);if(command)await executeCommand(message,command,parsed.args);return;}await runAutoMod(message);}catch(e){error('Message handler error',e instanceof Error?e.message:String(e));}});
client.on(Events.InteractionCreate,async interaction=>{try{if(!interaction.isChatInputCommand())return;const command=commands.get(interaction.commandName.toLowerCase());if(!command)return interaction.reply({content:'Unknown command.',ephemeral:true});await executeCommand(interaction,command);}catch(e){error('Interaction handler error',e instanceof Error?e.message:String(e));if(!interaction.replied&&!interaction.deferred)await interaction.reply({content:'An unexpected error occurred.',ephemeral:true}).catch(()=>{});}});
client.on(Events.GuildMemberAdd,member=>void recordJoin(member));
client.on(Events.ChannelDelete,channel=>{if(channel.guild)void recordDestructiveAction(channel.guild,'CHANNEL_DELETE',channel.id);});
client.on(Events.ChannelUpdate,(oldChannel,newChannel)=>{if(newChannel.guild&&isChannelPermissionEscalation(oldChannel,newChannel))void recordDestructiveAction(newChannel.guild,'CHANNEL_UPDATE',newChannel.id);});
client.on(Events.GuildRoleDelete,role=>void recordDestructiveAction(role.guild,'ROLE_DELETE',role.id));
client.on(Events.GuildRoleUpdate,(oldRole,newRole)=>{if(isRolePermissionEscalation(oldRole,newRole))void recordDestructiveAction(newRole.guild,'ROLE_UPDATE',newRole.id);});
client.on(Events.GuildBanAdd,ban=>void recordDestructiveAction(ban.guild,'BAN',ban.user.id));
client.on(Events.GuildMemberRemove,async member=>{if(!member.guild)return;const executor=await confirmKick(member.guild,member.id);if(executor)void recordDestructiveAction(member.guild,'KICK',member.id,executor);});

process.on('unhandledRejection',e=>error('UnhandledRejection',e));
process.on('uncaughtException',e=>{error('UncaughtException',e);process.exitCode=1;if(shutdown)shutdown();else process.exit(1);});

async function start(){
  const server=createHealthServer(client);
  shutdown=()=>{if(shuttingDown)return;shuttingDown=true;stopReminderService();stopTemporaryPunishmentService();clearStatusTimers();try{server.close();}catch{}try{client.destroy();}catch{}try{db.close();}catch{}};
  process.once('SIGINT',()=>{shutdown?.();process.exit(0);});
  process.once('SIGTERM',()=>{shutdown?.();process.exit(0);});
  try{await client.login(token);info('Startup: database ready');info(`Health: /health on port ${process.env.PORT||3000}`);info(`Discord: ${client.user?.tag||'unknown'}`);info(`Guilds: ${client.guilds.cache.size}`);}catch(e){error('Startup failed',e instanceof Error?e.message:String(e));shutdown();throw e;}
}
void start().catch(()=>process.exit(1));
