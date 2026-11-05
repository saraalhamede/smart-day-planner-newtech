import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { readConfig } from '../src/config.js';

let connection;
try {
  const { connectionLimit, ...options } = readConfig().db;
  connection = await mysql.createConnection(options);
  const sql = await readFile(new URL('../db/migrations/002-tasks.sql', import.meta.url), 'utf8');
  // One additive CREATE TABLE only. Existing tables cause an error, never a reset.
  await connection.query(sql);
  console.log('Phase 2 migration applied: tasks table created. Existing users preserved.');
} catch (error) {
  console.error(error.code ? `Tasks migration blocked (${error.code}). No existing table was reset; apply this migration once only.` : error.message);
  process.exitCode = 1;
} finally { if (connection) await connection.end(); }
