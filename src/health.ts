import express from 'express';
import db from './db';
import { info } from './logger';
import type { Client } from 'discord.js';

export function createHealthServer(client:Client){const app=express();app.disable('x-powered-by');app.get('/',(_req,res)=>res.status(200).json({service:'discord-bot',status:'ok'}));app.get('/health',(_req,res)=>{let dbok=true;try{db.prepare('SELECT 1').get();}catch{dbok=false;}const discord=Boolean(client.user)&&client.ws.status===0;res.status(dbok&&discord?200:503).json({status:dbok&&discord?'ok':'degraded',database:dbok?'connected':'down',discord:discord?'connected':'disconnected',user:client.user?.tag??null,guilds:client.guilds.cache.size,uptime:Math.floor(process.uptime())});});const port=Number(process.env.PORT||3000);const server=app.listen(port,()=>info(`Health server listening on ${port}`));return server;}
