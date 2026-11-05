import { createApp } from './app.js';
import { readConfig } from './config.js';
import { connectDatabase } from './database.js';

let database;
try {
  const config = readConfig();
  database = await connectDatabase(config);
  const server = createApp({ config, ...database }).listen(config.port, config.host, () => {
    console.log(`API ready at http://${config.host}:${config.port}; MySQL connected.`);
  });
  server.on('error', async () => { console.error('API could not start; check host and port.'); await database.close(); process.exitCode = 1; });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => { await database.close(); });
  });
} catch (error) {
  if (database) await database.close();
  // Config messages contain keys only; database errors may contain credentials.
  console.error(error.code ? `MySQL startup blocked (${error.code}). Check local credentials, service, and schema.` : error.message);
  process.exitCode = 1;
}
