const express = require('express');
const path = require('node:path');
const { createAuth } = require('./auth');
const { createMenu } = require('./menu');

function createApp(db, jwtSecret) {
  if (typeof jwtSecret !== 'string' || Buffer.byteLength(jwtSecret) < 32) {
    throw new Error('Set JWT_SECRET to a random value of at least 32 bytes.');
  }
  const app = express();
  const { router: auth, requireStaff } = createAuth(db.collection('users'), jwtSecret);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', async (req, res) => {
    try {
      await db.command({ ping: 1 });
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ error: 'Database is unavailable.' });
    }
  });
  app.use('/api/auth', auth);
  app.use('/api/pizzas', createMenu(db.collection('pizzas'), requireStaff));
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 11000) return res.status(409).json({ error: 'This pizza name is already in use.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body must be valid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    if (error.status >= 400 && error.status < 500) return res.status(error.status).json({ error: error.message });
    console.error('Request failed:', error.name);
    return res.status(500).json({ error: 'The request could not be completed.' });
  });
  return app;
}

module.exports = { createApp };
