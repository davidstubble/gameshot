const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const http = require('node:http');

const config = getDefaultConfig(__dirname);
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return middleware(req, res, next);
    // Fixed local target, never a client-supplied host. Stream the body without parsing it.
    const upstream = http.request({
      hostname: '127.0.0.1', port: 3000, path: req.url,
      method: req.method, headers: { ...req.headers, connection: 'close' },
    }, (response) => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.setTimeout(30000, () => upstream.destroy(new Error('API timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'API temporarily unavailable. Please retry.' })); }
      else res.destroy();
    });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  },
};
module.exports = withNativeWind(config, { input: './global.css' });
