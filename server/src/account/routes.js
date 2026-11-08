import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { hashPassword, verifyPassword } from '../passwords.js';
import { AccountError, validateAccount } from './validation.js';

const publicUser = ({ id, name, email }) => ({ id, name, email });
const invalidCredentials = () => new AccountError(401, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');

export function accountRoutes(authenticate, users, { cookieName, cookieOptions }) {
  const router = Router();
  router.use(authenticate);
  // Shared allowance for email/password changes; identity comes from authentication, never the body.
  const sensitiveLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: req => String(req.user.id), standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many account changes. Try again in 15 minutes.' } });
  router.patch('/profile', async (req, res) => {
    const { name } = validateAccount(req.body, 'profile');
    const user = await users.updateName(req.user.id, name);
    if (!user) throw new AccountError(401, 'Authentication required.');
    res.json({ user: publicUser(user) });
  });
  async function credentials(req, section) {
    const input = validateAccount(req.body, section);
    const user = await users.findCredentialsById(req.user.id);
    if (!user) throw new AccountError(401, 'Authentication required.');
    if (!await verifyPassword(input.currentPassword, user.password_hash)) throw invalidCredentials();
    return { input, user };
  }
  router.patch('/email', sensitiveLimit, async (req, res) => {
    const { input, user } = await credentials(req, 'email');
    try {
      // Compare the credential hash atomically so a simultaneous password change cannot authorize a stale request.
      if (!await users.updateEmail(user.id, input.email, user.password_hash)) throw invalidCredentials();
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new AccountError(409, 'An account with that email already exists.');
      throw error;
    }
    const updated = await users.findById(user.id);
    if (!updated) throw new AccountError(401, 'Authentication required.');
    res.json({ user: publicUser(updated) });
  });
  router.post('/password', sensitiveLimit, async (req, res) => {
    const { input, user } = await credentials(req, 'password');
    if (await verifyPassword(input.newPassword, user.password_hash)) throw new AccountError(400, 'Choose a password different from your current password.');
    const passwordHash = await hashPassword(input.newPassword);
    const changed = await users.updatePassword(user.id, user.password_hash, passwordHash, req.sessionID);
    if (!changed) throw invalidCredentials();
    // The committed transaction already removed this exact session from the existing MySQL store.
    // Discard the in-request object so express-session cannot save it again at response completion.
    req.session = null;
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  });
  router.use((error, req, res, next) => {
    if (error instanceof AccountError) return res.status(error.status).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
    next(error);
  });
  return router;
}
