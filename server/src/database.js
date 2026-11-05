import mysql from 'mysql2/promise';
import session from 'express-session';
import mysqlSession from 'express-mysql-session';
import { createUserRepository } from './users.js';
import { createTaskRepository } from './tasks/repository.js';

const MySQLStore = mysqlSession(session);

export async function connectDatabase(config) {
  const pool = mysql.createPool(config.db);
  let store;
  try {
    await pool.query('SELECT 1');
    await pool.query('SELECT id, name, email, password_hash FROM users LIMIT 0');
    await pool.query('SELECT session_id, expires, data FROM sessions LIMIT 0');
    await pool.query('SELECT id, user_id, task_date, start_time, end_time, priority, status FROM tasks LIMIT 0');
    store = new MySQLStore({ createDatabaseTable: false, endConnectionOnClose: false, clearExpired: true, checkExpirationInterval: 900000, expiration: 28800000 }, pool);
    store.on('error', () => console.error('Session storage operation failed.'));
    await store.onReady();
    return { pool, store, users: createUserRepository(pool), tasks: createTaskRepository(pool), async close() { await store.close(); await pool.end(); } };
  } catch (error) {
    if (store) await store.close();
    await pool.end();
    throw error;
  }
}
