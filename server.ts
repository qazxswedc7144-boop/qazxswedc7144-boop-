import express from 'express';
import path from 'path';
import fs from 'fs';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logger for debugging fetch errors
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} [SERVER] ${req.method} ${req.url} Referer: ${req.get('Referer')}`);
    next();
  });

  // API health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'pharma-flow' });
  });

  // Determine if we are in production
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.resolve(__dirname, 'dist');
  const distExists = fs.existsSync(distPath);
  
  // Vite middleware for development (always in dev, unless explicitly production)
  if (!isProduction) {
    console.log("Starting in DEVELOPMENT mode with Vite middleware...");
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode
    console.log(`Starting in PRODUCTION mode. Serving static files from: ${distPath}`);
    
    if (!distExists) {
      console.error(`❌ CRITICAL ERROR: dist directory not found at ${distPath} in production mode!`);
    }

    app.use(express.static(distPath));
    
    // Catch-all pattern for SPA (Express 5 compatible)
    app.get('*all', (req, res, next) => {
      // Skip if it's an API request or a source file request
      if (req.url.startsWith('/api/') || req.url.startsWith('/src/')) {
        return res.status(404).send('Not Found');
      }
      
      const indexPath = path.join(distPath, 'index.html');
      console.log(`Serving index file from: ${indexPath}`);
      
      res.sendFile(indexPath, (err) => {
        if (err) {
          // If index.html is missing, don't crash, but return 404 for non-API
          if (!res.headersSent) {
            res.status(404).send('Not Found');
          }
        }
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
