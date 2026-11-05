import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { readConfig, DATABASE_NAME } from '../src/config.js';

let connection;
try {
  const config = readConfig();
  const { database, connectionLimit, ...options } = config.db;
  connection = await mysql.createConnection(options);
  // Deliberately fails if this name exists. No reset, drop, or modification of existing databases.
  await connection.query(`CREATE DATABASE \`${DATABASE_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.changeUser({ database });
  for (const path of ['../db/schema.sql', '../db/migrations/002-tasks.sql']) {
    const schema = await readFile(new URL(path, import.meta.url), 'utf8');
    for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) await connection.query(statement);
  }
  console.log(`Created ${DATABASE_NAME}: users, sessions, tasks.`);
} catch (error) {
  console.error(error.code ? `Database initialization blocked (${error.code}). No existing database was reset. If a new schema was partly created, inspect it manually.` : error.message);
  process.exitCode = 1;
} finally { if (connection) await connection.end(); }
