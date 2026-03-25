import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { apiRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeBase(p: string): string {
  let s = p.trim() || '/prod-uchet';
  if (!s.startsWith('/')) s = '/' + s;
  return s.replace(/\/$/, '') || '';
}

const BASE = normalizeBase(process.env.PUBLIC_BASE_PATH || '/prod-uchet/');
const PORT = Number(process.env.PORT || 3847);

const app = express();
app.use(express.json({ limit: '2mb' }));

initDb();

app.use(`${BASE}/api`, apiRouter);

const dist = path.resolve(__dirname, '../../client/dist');

if (fs.existsSync(dist)) {
  app.use(
    BASE,
    express.static(dist, {
      index: 'index.html',
      fallthrough: true,
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path !== BASE && !req.path.startsWith(BASE + '/')) return next();
    if (req.path.startsWith(BASE + '/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
} else {
  app.get(BASE, (_req, res) => {
    res.type('html').send(`<p>Соберите клиент: <code>npm run build -w client</code></p><p>API: <code>${BASE}/api/me</code></p>`);
  });
}

app.listen(PORT, () => {
  console.log(`[maxim-production-tg] http://127.0.0.1:${PORT}${BASE}/  api → ${BASE}/api`);
});
