import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'path';
import { loadEnv, defineConfig, type Plugin } from 'vite';
import tbaHandler from './api/tba/[resource]/[eventKey].js';
import matchDetailHandler from './api/tba/match_detail.js';

function createTbaDevApiPlugin(): Plugin {
  return {
    name: 'tba-dev-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      if (!process.env.TBA_API_KEY && env.TBA_API_KEY) {
        process.env.TBA_API_KEY = env.TBA_API_KEY;
      }

      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.url || '/', 'http://localhost');
        const pathParts = requestUrl.pathname.split('/').filter(Boolean);
        if (pathParts[0] !== 'api' || pathParts[1] !== 'tba') {
          next();
          return;
        }

        const isMatchDetailQuery = pathParts.length === 3 && pathParts[2] === 'match_detail';
        const isDynamicTbaRoute = pathParts.length === 4;
        if (!isMatchDetailQuery && !isDynamicTbaRoute) {
          next();
          return;
        }

        const query = Object.fromEntries(requestUrl.searchParams.entries());
        const handler = isMatchDetailQuery ? matchDetailHandler : tbaHandler;
        if (isDynamicTbaRoute) {
          query.resource = decodeURIComponent(pathParts[2]);
          query.eventKey = decodeURIComponent(pathParts[3]);
        }

        const apiRequest = Object.assign(req, { query }) as IncomingMessage & { query: Record<string, string> };
        const apiResponse = res as ServerResponse & {
          status: (statusCode: number) => typeof res;
          json: (body: unknown) => typeof res;
        };

        apiResponse.status = (statusCode: number) => {
          res.statusCode = statusCode;
          return res;
        };
        apiResponse.json = (body: unknown) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
          return res;
        };

        try {
          await handler(apiRequest, apiResponse);
        } catch (error) {
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }));
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), createTbaDevApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
