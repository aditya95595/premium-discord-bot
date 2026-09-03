import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import path from 'path';
import type { Client } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import db from './db';
import { getGuildSettings, setGuildSetting } from './db/settings';

const SESSION_COOKIE = 'dashboard_session';
const SESSION_TTL = 24 * 60 * 60 * 1000;
const secret = process.env.SESSION_SECRET || process.env.DASHBOARD_SESSION_SECRET;
if (!secret) console.warn('[Dashboard] SESSION_SECRET is not set; dashboard login is disabled until it is configured.');
const key = secret ? crypto.createHash('sha256').update(secret).digest() : null;
const sessions = new Map<string, { userId: string; expiresAt: number }>();
const loginStates = new Map<string, number>();

function b64(buf: Buffer) { return buf.toString('base64url'); }
function unb64(v: string) { return Buffer.from(v, 'base64url'); }
function seal(payload: object) {
  if (!key) throw new Error('Dashboard session secret is not configured.');
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.from(JSON.stringify(payload));
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  return `${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(encrypted)}`;
}
function open(token: string) {
  if (!key) return null;
  try {
    const [iv, tag, encrypted] = token.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, unb64(iv));
    decipher.setAuthTag(unb64(tag));
    return JSON.parse(Buffer.concat([decipher.update(unb64(encrypted)), decipher.final()]).toString()) as { userId: string; exp: number };
  } catch { return null; }
}
function getSession(req: Request) {
  const token = req.headers.cookie?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!token) return null;
  const data = open(decodeURIComponent(token));
  if (!data || data.exp < Date.now()) return null;
  return data;
}
function origin(req: Request) {
  if (process.env.DASHBOARD_PUBLIC_URL) return process.env.DASHBOARD_PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto']?.toString().split(',')[0] || req.protocol;
  const host = req.headers['x-forwarded-host']?.toString().split(',')[0] || req.get('host');
  return `${proto}://${host}`;
}
function redirectUri(req: Request) { return process.env.DISCORD_REDIRECT_URI || `${origin(req)}/auth/callback`; }
async function discordJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`Discord API ${r.status}`);
  return r.json() as Promise<any>;
}
async function currentUser(req: Request) {
  const session = getSession(req);
  if (!session) return null;
  return { id: session.userId };
}
function canManageGuild(client: Client, guildId: string, userId: string) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;
  if (guild.ownerId === userId) return true;
  const member = guild.members.cache.get(userId);
  return Boolean(member && (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild)));
}
function requireAuth(req: Request, res: Response) {
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: 'Authentication required.' }); return null; }
  return session;
}

export function createDashboardRouter(client: Client) {
  const router = express.Router();
  router.get('/auth/login', (req, res) => {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !secret) return res.status(503).send('Dashboard authentication is not configured.');
    const state = b64(crypto.randomBytes(24));
    loginStates.set(state, Date.now() + 10 * 60_000);
    const params = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, response_type: 'code', redirect_uri: redirectUri(req), scope: 'identify guilds' });
    res.redirect(`https://discord.com/oauth2/authorize?${params}&state=${state}`);
  });
  router.get('/auth/callback', async (req, res) => {
    try {
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const expiry = loginStates.get(state);
      loginStates.delete(state);
      if (!code || !expiry || expiry < Date.now()) return res.status(400).send('Invalid or expired login request.');
      const body = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID!, client_secret: process.env.DISCORD_CLIENT_SECRET!, grant_type: 'authorization_code', code, redirect_uri: redirectUri(req) });
      const token = await discordJson('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      const user = await discordJson('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } });
      const sessionToken = seal({ userId: user.id, exp: Date.now() + SESSION_TTL });
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}`);
      res.redirect('/');
    } catch { res.status(502).send('Discord login failed. Check OAuth settings.'); }
  });
  router.post('/auth/logout', (_req, res) => { res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`); res.json({ ok: true }); });
  router.get('/api/me', async (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ authenticated: false });
    try {
      const user = await discordJson(`https://discord.com/api/v10/users/${session.userId}`);
      return res.json({ authenticated: true, user: { id: user.id, username: user.username, global_name: user.global_name, avatar: user.avatar } });
    } catch { return res.status(401).json({ authenticated: false }); }
  });
  router.get('/api/guilds', async (req, res) => {
    const session = requireAuth(req, res); if (!session) return;
    try {
      const guilds = await discordJson('https://discord.com/api/v10/users/@me/guilds', { headers: { Authorization: `Bearer ${req.headers.authorization?.replace(/^Bearer\s+/i, '') || ''}` } }).catch(() => null);
      const result = client.guilds.cache.filter(g => canManageGuild(client, g.id, session.userId)).map(g => ({ id: g.id, name: g.name, icon: g.icon, owner: g.ownerId === session.userId }));
      return res.json({ guilds: result, discordGuildCount: Array.isArray(guilds) ? guilds.length : null });
    } catch { return res.status(500).json({ error: 'Unable to load servers.' }); }
  });
  router.get('/api/guild/:guildId/bootstrap', (req, res) => {
    const session = requireAuth(req, res); if (!session) return;
    const guildId = req.params.guildId;
    if (!canManageGuild(client, guildId, session.userId)) return res.status(403).json({ error: 'You cannot manage this server.' });
    const guild = client.guilds.cache.get(guildId)!;
    const settings = getGuildSettings(guildId);
    const cases = db.prepare('SELECT COUNT(*) count FROM infractions WHERE guild_id=?').get(guildId) as { count: number };
    const warnings = db.prepare("SELECT COUNT(*) count FROM infractions WHERE guild_id=? AND type='warn'").get(guildId) as { count: number };
    const audit = db.prepare('SELECT * FROM audit_events WHERE guild_id=? ORDER BY timestamp DESC LIMIT 20').all(guildId);
    const roles = guild.roles.cache.filter(r => !r.managed).sort((a,b) => b.position-a.position).map(r => ({ id:r.id, name:r.name, position:r.position }));
    const channels = guild.channels.cache.filter(c => c.isTextBased()).map(c => ({ id:c.id, name:c.name, type:c.type }));
    const statuses = db.prepare('SELECT id,text,type,position FROM statuses WHERE guild_id=? ORDER BY position,id').all(guildId);
    return res.json({ guild:{id:guild.id,name:guild.name,icon:guild.icon}, bot:{online:client.ws.status===0,username:client.user?.tag||null,uptime:Math.floor(process.uptime()),latency:client.ws.ping}, settings, stats:{members:guild.memberCount,cases:cases.count,warnings:warnings.count}, audit, roles, channels, statuses });
  });
  router.post('/api/guild/:guildId/config', express.json({ limit: '32kb' }), (req, res) => {
    const session = requireAuth(req, res); if (!session) return;
    const guildId = req.params.guildId;
    if (!canManageGuild(client, guildId, session.userId)) return res.status(403).json({ error: 'You cannot manage this server.' });
    const allowed = new Set(['prefix','mod_log_channel','staff_roles','automod_enabled','automod_profanity','automod_caps','automod_links','automod_spam_threshold','automod_mention_limit','automod_invites','automod_blocked_words','automod_punishment','raid_mode','raid_threshold','raid_window_seconds','status_rotation_enabled','status_rotation_interval']);
    const body = req.body || {};
    try {
      for (const [k,v] of Object.entries(body)) {
        if (!allowed.has(k)) continue;
        if (k === 'prefix') { if (typeof v !== 'string' || v.length < 1 || v.length > 5) throw new Error('Prefix must be 1-5 characters.'); }
        if (k.endsWith('_channel') && v !== null && typeof v !== 'string') throw new Error('Invalid channel.');
        if (k === 'staff_roles' && typeof v !== 'string') throw new Error('Invalid staff roles.');
        if (k.includes('threshold') || k.includes('interval') || k.includes('limit') || k === 'automod_punishment') { if (typeof v !== 'string' && typeof v !== 'number') throw new Error(`Invalid ${k}.`); }
        setGuildSetting(guildId, k as any, v as any);
      }
      return res.json({ ok:true, settings:getGuildSettings(guildId) });
    } catch(e) { return res.status(400).json({ error:e instanceof Error?e.message:'Invalid configuration.' }); }
  });
  router.post('/api/guild/:guildId/statuses', express.json({limit:'16kb'}), (req,res)=>{
    const session=requireAuth(req,res); if(!session)return;
    const guildId=req.params.guildId; if(!canManageGuild(client,guildId,session.userId))return res.status(403).json({error:'You cannot manage this server.'});
    const {action,text,type='PLAYING'}=req.body||{};
    try {
      if(action==='clear'){db.prepare('DELETE FROM statuses WHERE guild_id=?').run(guildId);}
      else if(action==='add'){if(typeof text!=='string'||!text.trim()||text.length>128)throw new Error('Status text must be 1-128 characters.'); if(!['PLAYING','WATCHING','LISTENING','STREAMING','COMPETING'].includes(type))throw new Error('Invalid activity type.'); const p=(db.prepare('SELECT COALESCE(MAX(position),-1)+1 p FROM statuses WHERE guild_id=?').get(guildId) as any).p;db.prepare('INSERT INTO statuses(guild_id,text,type,position) VALUES(?,?,?,?)').run(guildId,text.trim(),type,p);}
      else if(action==='apply'){const row=db.prepare('SELECT text,type FROM statuses WHERE guild_id=? ORDER BY position,id LIMIT 1').get(guildId) as any; if(row) client.user?.setActivity(row.text,{type:({PLAYING:0,STREAMING:1,LISTENING:2,WATCHING:3,COMPETING:5} as any)[row.type]??0);}
      else throw new Error('Unknown status action.');
      return res.json({ok:true,statuses:db.prepare('SELECT id,text,type,position FROM statuses WHERE guild_id=? ORDER BY position,id').all(guildId)});
    }catch(e){return res.status(400).json({error:e instanceof Error?e.message:'Status update failed.'});}
  });
  router.delete('/api/guild/:guildId/statuses/:id', (req,res)=>{
    const session=requireAuth(req,res);if(!session)return;const guildId=req.params.guildId;if(!canManageGuild(client,guildId,session.userId))return res.status(403).json({error:'You cannot manage this server.'});db.prepare('DELETE FROM statuses WHERE guild_id=? AND id=?').run(guildId,req.params.id);return res.json({ok:true});
  });
  return router;
}

export function dashboardStaticPath() { return path.join(process.cwd(), 'dashboard'); }
