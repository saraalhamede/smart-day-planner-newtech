import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword } from './passwords.js';
import { requireAuth } from './middleware/require-auth.js';

const publicUser = ({ id, name, email }) => ({ id, name, email });
const sessionAction = (req, method) => new Promise((resolve, reject) => req.session[method]((error) => error ? reject(error) : resolve()));

export function createApp({ config, users, store }) {
  if (!store) throw new Error('An explicit server session store is required.');
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== config.origin) {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  const cookieName = 'sdp_newtech.sid';
  const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/' };
  app.use('/api', session({
    name: cookieName, secret: config.secret, store,
    resave: false, saveUninitialized: false,
    cookie: { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 },
  }));
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many attempts. Try again in 15 minutes.' } });
  app.use(['/api/auth/register', '/api/auth/login'], limiter);
  const dummyHash = hashPassword('dummy-account-password-for-timing');
  const authenticate = requireAuth(users);

  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
        typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== 'string' || password.length < 12 || password.length > 128) {
      return res.status(400).json({ error: 'Enter a name (1–100 characters), valid email, and password (12–128 characters).' });
    }
    try {
      const user = await users.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await hashPassword(password) });
      res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with that email already exists.' });
      throw error;
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || !email.trim() || email.length > 254 || typeof password !== 'string' || !password || password.length > 128) {
      return res.status(400).json({ error: 'Enter your email and password.' });
    }
    const user = await users.findByEmail(email.trim().toLowerCase());
    const valid = await verifyPassword(password, user?.password_hash || await dummyHash);
    if (!user || !valid) return res.status(401).json({ error: 'Invalid email or password.' });
    await sessionAction(req, 'regenerate');
    req.session.userId = user.id;
    await sessionAction(req, 'save');
    res.json({ user: publicUser(user) });
  });

  app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
  app.post('/api/auth/logout', authenticate, async (req, res) => {
    await sessionAction(req, 'destroy');
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
  if (config.production) {
    const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
    app.use(express.static(clientDist));
    app.get('/{*path}', (req, res) => res.sendFile(`${clientDist}index.html`));
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    // Never log request bodies, connection options, cookies, or raw database errors.
    console.error('API request failed.');
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });
  return app;
}
