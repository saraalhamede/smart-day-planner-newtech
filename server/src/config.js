import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export const DATABASE_NAME = 'smart_day_planner_newtech';

export function readConfig(env = process.env) {
  const required = (key) => {
    const value = env[key];
    if (!value || value.startsWith('replace-')) throw new Error(`Configure ${key} in the project .env file.`);
    return value;
  };
  const port = (key, fallback) => {
    const value = Number(env[key] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`Invalid ${key}.`);
    return value;
  };
  const secret = required('SESSION_SECRET');
  if (secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 random characters.');
  if (env.DB_NAME !== DATABASE_NAME) throw new Error(`DB_NAME must be ${DATABASE_NAME}; existing databases are protected.`);
  const origin = new URL(required('CLIENT_ORIGIN'));
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== env.CLIENT_ORIGIN) throw new Error('CLIENT_ORIGIN must be an exact HTTP(S) origin without a trailing slash.');
  const production = env.NODE_ENV === 'production';
  if (production && origin.protocol !== 'https:') throw new Error('Production requires an HTTPS CLIENT_ORIGIN.');
  return {
    production, secret, origin: origin.origin,
    host: env.HOST || '127.0.0.1', port: port('PORT', 3001),
    trustProxy: env.TRUST_PROXY === 'true',
    db: { host: env.DB_HOST || '127.0.0.1', port: port('DB_PORT', 3306), user: required('DB_USER'), password: required('DB_PASSWORD'), database: DATABASE_NAME, connectionLimit: 5, connectTimeout: 5000, charset: 'utf8mb4' },
  };
}
