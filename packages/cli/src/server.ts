import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

export interface ServerHandle {
  server: Server;
  port: number;
  url: string;
  close: () => Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function renderFallbackHtml(reportJson: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Placard — Report viewer</title>
  <style>
    body { background: #14101F; color: #EDE6D6; font-family: sans-serif; padding: 2rem; }
    h1 { color: #F2A541; }
    pre { background: #2A2140; padding: 1rem; border-radius: 8px; overflow: auto; max-height: 70vh; }
  </style>
</head>
<body>
  <h1>🏚️ Placard — Skeletons in the Closet</h1>
  <p>Local report viewer (standalone server on 127.0.0.1).</p>
  <pre id="report">${reportJson.replace(/</g, '&lt;')}</pre>
</body>
</html>`;
}

export async function createReportServer(reportPath: string, port = 0): Promise<ServerHandle> {
  const resolved = resolve(reportPath);
  const webDist = resolve(process.cwd(), 'packages/web/dist');

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    if (url.pathname === '/report.json') {
      try {
        const raw = await readFile(resolved, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(raw);
        return;
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Report not found');
        return;
      }
    }

    try {
      const filePath = resolve(webDist, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      if (filePath.startsWith(webDist)) {
        const st = await stat(filePath).catch(() => null);
        if (st?.isFile()) {
          const content = await readFile(filePath);
          const ext = extname(filePath);
          res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
          res.end(content);
          return;
        }
      }
    } catch {
      // repli
    }

    const raw = await readFile(resolved, 'utf-8').catch(() => '{"findings":[]}');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderFallbackHtml(raw));
  });

  return new Promise((resolveHandle) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      const url = `http://127.0.0.1:${actualPort}`;
      resolveHandle({
        server,
        port: actualPort,
        url,
        close: () => new Promise<void>((cb) => server.close(() => cb())),
      });
    });
  });
}

export async function startReportServer(reportPath: string, port?: number): Promise<ServerHandle> {
  return createReportServer(reportPath, port);
}
