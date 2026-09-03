import express from 'express';
import db from './db';
import { info } from './logger';
import type { Client } from 'discord.js';

export function createHealthServer(client: Client) {
  const app = express();
  app.get('/health', (_req, res) => {
    const dbok = !!db;
    const ok = {
      status: 'ok',
      db: dbok ? 'connected' : 'down',
      bot: client && client.user ? 'connected' : 'disconnected',
      user: client.user ? client.user.tag : null,
      guilds: client.guilds.cache.size
    };
    res.json(ok);
  });
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => info(`Health server listening on ${port}`));
  return server;
}
