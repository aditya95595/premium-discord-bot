import crypto from 'crypto';
import express,{type Request,type Response} from 'express';
import type {Client} from 'discord.js';
import {PermissionFlagsBits} from 'discord.js';
import db from './db';
import {getGuildSettings,setGuildSetting} from './db/settings';
import {getClan,getPlayer,getCurrentWar,getWarLog,getCwlLeague,cocConfigured,clanSummary} from './services/coc';

const COOKIE='dashboard_session';
const secret=process.env.SESSION_SECRET||process.env.DASHBOARD_SESSION_SECRET;
const key=secret?crypto.createHash('sha256').update(secret).digest():null;
function session(req:Request){
  if(!key)return null;const raw=req.headers.cookie?.match(new RegExp(`${COOKIE}=([^;]+)`))?.[1];if(!raw)return null;
  try{const [iv,tag,body]=decodeURIComponent(raw).split('.');const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));d.setAuthTag(Buffer.from(tag,'base64url'));const s=JSON.parse(Buffer.concat([d.update(Buffer.from(body,'base64url')),d.final()]).toString());return s.exp>Date.now()?s:null;}catch{return null;}
}
function csrf(req:Request,s:any){const supplied=req.get('x-dashboard-csrf')||'';return Boolean(s?.csrf&&supplied&&supplied.length===s.csrf.length&&crypto.timingSafeEqual(Buffer.from(s.csrf),Buffer.from(supplied)));}
async function allowed(client:Client,guildId:string,userId:string){const g=client.guilds.cache.get(guildId);if(!g)return false;if(g.ownerId===userId)return true;const m=await g.members.fetch(userId).catch(()=>null);return Boolean(m&&(m.permissions.has(PermissionFlagsBits.Administrator)||m.permissions.has(PermissionFlagsBits.ManageGuild)));}

export function createCocDashboardRouter(client:Client){
 const r=express.Router();
 r.get('/api/guild/:guildId/coc',async(req,res)=>{const s=session(req);if(!s)return res.status(401).json({error:'Authentication required.'});const id=req.params.guildId;if(!await allowed(client,id,s.userId))return res.status(403).json({error:'You cannot manage this server.'});const settings=getGuildSettings(id);const tag=settings.coc_clan_tag||process.env.COC_DEFAULT_CLAN_TAG||'';if(!tag)return res.json({configured:cocConfigured(),tag:'',clan:null,war:null,warlog:[],cwl:null});if(!cocConfigured())return res.json({configured:false,tag,clan:null,war:null,warlog:[],cwl:null});
  try{const [clan,war,warlog,cwl]=await Promise.all([getClan(tag),getCurrentWar(tag).catch(()=>null),getWarLog(tag).catch(()=>({items:[]})),getCwlLeague(tag).catch(()=>null)]);return res.json({configured:true,tag,clan:clanSummary(clan),members:(clan.memberList||[]).slice(0,50),war,warlog:(warlog?.items||[]).slice(0,10),cwl});}catch(e){return res.status(502).json({error:e instanceof Error?e.message:'CoC API request failed.'});}
 });
 r.get('/api/guild/:guildId/coc/player/:tag',async(req,res)=>{const s=session(req);if(!s)return res.status(401).json({error:'Authentication required.'});if(!await allowed(client,req.params.guildId,s.userId))return res.status(403).json({error:'You cannot manage this server.'});try{return res.json(await getPlayer(req.params.tag));}catch(e){return res.status(502).json({error:e instanceof Error?e.message:'Player lookup failed.'});}});
 r.post('/api/guild/:guildId/coc/config',express.json({limit:'4kb'}),async(req,res)=>{const s=session(req);if(!s||!csrf(req,s))return res.status(403).json({error:'Invalid dashboard security token.'});const id=req.params.guildId;if(!await allowed(client,id,s.userId))return res.status(403).json({error:'You cannot manage this server.'});const tag=String(req.body?.tag||'').trim().toUpperCase();if(tag&&!/^#[A-Z0-9]{3,15}$/.test(tag))return res.status(400).json({error:'Invalid clan tag.'});setGuildSetting(id,'coc_clan_tag',tag);db.prepare('INSERT INTO audit_events(guild_id,action,target_id,executor_id,timestamp) VALUES(?,?,?,?,?)').run(id,'coc_config_updated',tag||null,s.userId,Date.now());return res.json({ok:true,tag});});
 return r;
}
