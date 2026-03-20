import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import syncRouter from './server/routes/sync.js';
import dataRouter from './server/routes/data.js';
import healthRouter from './server/routes/health.js';
import tbaRouter from './server/routes/tba.js';
import geminiRouter from './server/routes/gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.use('/api/sync', syncRouter);
  app.use('/api/data', dataRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/tba', tbaRouter);
  app.use('/api/gemini', geminiRouter);

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
