import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes.js';
import { seedInitialData } from './server/seed.js';
import { isRequestAuthorized, renderCoffeeShopGateHtml } from './server/gate.js';

async function startServer() {
  const app = express();
  const PORT = 3007;

  // Cookie and JSON Body parsing
  app.use(cookieParser());
  app.use(express.json());

  // Public Assets (favicon & og-image for social networks and messenger crawlers)
  const publicDir = path.join(process.cwd(), 'public');
  app.use('/favicon.svg', (req, res) => res.sendFile(path.join(publicDir, 'favicon.svg')));
  app.use('/og-image.png', (req, res) => res.sendFile(path.join(publicDir, 'og-image.png')));
  app.use('/og-image.svg', (req, res) => res.sendFile(path.join(publicDir, 'og-image.svg')));

  // Seed demo data only if explicitly configured via environment variable
  if (process.env.SEED_DEMO_DATA === 'true') {
    try {
      seedInitialData();
    } catch (err) {
      console.error('Error seeding initial data:', err);
    }
  }

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Mount API routes
  app.use('/api', apiRouter);

  // Anti-Bot & Cloaking Gate Middleware
  const sitekey = process.env.VITE_HCAPTCHA_SITEKEY || process.env.HCAPTCHA_SITEKEY || '10000000-ffff-ffff-ffff-000000000001';

  app.use((req, res, next) => {
    // Skip if already an API route or public asset
    if (
      req.path.startsWith('/api') ||
      req.path === '/favicon.svg' ||
      req.path === '/og-image.png' ||
      req.path === '/og-image.svg'
    ) {
      return next();
    }

    const { isAuthorized, gatePass } = isRequestAuthorized(req);

    // If unauthorized and no 24h gate cookie: DO NOT send the real app.
    // Send ONLY the Czech Coffee Shop Landing + Captcha Gate overlay!
    if (!isAuthorized) {
      const isPageRequest = req.accepts('html') || !path.extname(req.path) || req.path === '/';
      if (isPageRequest) {
        const currentSitekey = process.env.VITE_HCAPTCHA_SITEKEY || process.env.HCAPTCHA_SITEKEY || '10000000-ffff-ffff-ffff-000000000001';
        return res.status(200).send(renderCoffeeShopGateHtml(currentSitekey));
      }
      return res.status(403).send('Forbidden: Gate verification required');
    }

    // If verified via query param, set cookie as well
    if (req.query.gate_pass && typeof req.query.gate_pass === 'string') {
      res.cookie('scam_gate_pass', req.query.gate_pass, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: false,
        sameSite: 'none',
        secure: true,
        path: '/',
      });
    }

    // Authorized user or valid 24h pass: continue to real SPA
    next();
  });

  // Vite middleware for development vs static for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Scamulator server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

