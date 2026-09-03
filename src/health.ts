import express from 'express';
import db from './db';
import { info } from './logger';
import type { Client } from 'discord.js';
import { createDashboardRouter, dashboardStaticPath } from './dashboard';

export function createHealthServer(client:Client){
  const app=express();
  app.disable('x-powered-by');
  app.set('trust proxy',1);
  app.get('/health',(_req,res)=>{let dbok=true;try{db.prepare('SELECT 1').get();}catch{dbok=false;}const discord=Boolean(client.user)&&client.ws.status===0;res.status(dbok&&discord?200:503).json({status:dbok&&discord?'ok':'degraded',database:dbok?'connected':'down',discord:discord?'connected':'disconnected',user:client.user?.tag??null,guilds:client.guilds.cache.size,uptime:Math.floor(process.uptime())});});
  app.use(createDashboardRouter(client));
  app.use('/dashboard',express.static(dashboardStaticPath(),{index:'index.html',maxAge:'1h'}));
  app.get('/',(_req,res)=>res.redirect('/dashboard/'));
  app.use((_req,res)=>res.status(404).json({error:'Not found'}));
  const port=Number(process.env.PORT||3000);
  const server=app.listen(port,()=>info(`HTTP server listening on ${port} (dashboard + health)`));
  return server;
}
