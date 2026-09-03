import express from 'express';
import db from './db';
import { info } from './logger';
import type { Client } from 'discord.js';
import { createDashboardRouter, dashboardStaticPath } from './dashboard';

const MAX_BODY = '32kb';

export function createHealthServer(client: Client) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Baseline security headers. Dashboard routes add their own auth/CSRF controls.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://cdn.discordapp.com https://media.discordapp.net; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    next();
  });

  app.get('/health', (_req, res) => {
    let dbok = true;
    try { db.prepare('SELECT 1').get(); } catch { dbok = false; }
    const discord = Boolean(client.user) && client.ws.status === 0;
    res.status(dbok && discord ? 200 : 503).json({
      status: dbok && discord ? 'ok' : 'degraded',
      database: dbok ? 'connected' : 'down',
      discord: discord ? 'connected' : 'disconnected',
      user: client.user?.tag ?? null,
      guilds: client.guilds.cache.size,
      uptime: Math.floor(process.uptime()),
    });
  });

  app.use(createDashboardRouter(client));
  app.use('/dashboard', express.static(dashboardStaticPath(), {
    index: 'index.html',
    maxAge: '1h',
    dotfiles: 'deny',
  }));
  app.get('/', (_req, res) => res.redirect('/dashboard/'));
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    info(`HTTP request rejected: ${err instanceof Error ? err.message : String(err)}`);
    if (res.headersSent) return;
    res.status(400).json({ error: 'Invalid request.' });
  });

  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  const server = app.listen(port, () => info(`HTTP server listening on ${port} (dashboard + health)`));
  return server;
}
