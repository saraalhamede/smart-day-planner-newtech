import { readConfig } from '../src/config.js';
import { connectDatabase } from '../src/database.js';

try {
  const db = await connectDatabase(readConfig());
  console.log('MySQL connection, users/tasks tables, and session store ready.');
  await db.close();
} catch (error) {
  console.error(error.code ? `MySQL verification blocked (${error.code}).` : error.message);
  process.exitCode = 1;
}
