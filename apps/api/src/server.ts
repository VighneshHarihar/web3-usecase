import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { initChain } from './chain/index.js';
import { startWorkers } from './workers/index.js';

async function main() {
  await runMigrations();
  const app = await buildApp();
  try {
    const c = await initChain();
    if (c) app.log.info({ escrow: c.escrow, token: c.token, chainId: c.chainId }, 'chain ready');
  } catch (e) {
    app.log.error(e, 'chain init failed; continuing with the ledger only (events stay pending)');
  }
  const stopWorkers = config.WORKERS ? startWorkers(app.log) : async () => undefined;
  await app.listen({ port: config.PORT, host: config.HOST });
  const shutdown = async () => {
    app.log.info('shutting down');
    await stopWorkers();
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
