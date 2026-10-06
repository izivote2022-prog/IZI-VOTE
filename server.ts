import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { apiRouter } from './src/server/routes.js';

async function startServer() {
  const app = express();
  const port = parseInt(process.env.PORT || '3000', 10);
  const isProd = process.env.NODE_ENV === 'production';

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Return 404 JSON for any unmatched /api routes so they never fall through to Vite SPA
  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found.' });
  });

  if (!isProd) {
    // Vite Dev Server middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static build in production
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[IZI 2027-2028 MAKAI DING KI TEL NA] Server listening at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[IZI 2027-2028 MAKAI DING KI TEL NA] Failed to start server:', err);
  process.exit(1);
});
