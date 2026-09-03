import express from 'express';
import db from './db';
import { info } from './logger';
import type { Client } from 'discord.js';
export function createHealthServer(client:Client){const app=express();app.disable('x-powered-by');app.get('/',(_req,res)=>res.status(200).send('Discord bot online'));app.get('/health',(_req,res)=>{const connected=!!client.user;res.status(connected?200:503).json({status:connected?'ok':'degraded',db:'connected',bot:connected?'connected':'disconnected',user:client.user?.tag??null,guilds:client.guilds.cache.size,uptime:process.uptime()});});const port=Number(process.env.PORT||3000);return app.listen(port,()=>info(`Health server listening on ${port}`));}
