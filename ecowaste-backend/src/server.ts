import app from './app';
import { env } from './config/env';
import { closeDb, initDb } from './config/db';
import { markOverduePickups } from './services/pickupLifecycleService';

const DEFAULT_OVERDUE_SWEEP_MS = 60_000;

const resolveOverdueSweepIntervalMs = (): number => {
  const raw = process.env.PICKUP_OVERDUE_SWEEP_MS;
  if (!raw) {
    return DEFAULT_OVERDUE_SWEEP_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_OVERDUE_SWEEP_MS;
  }
  return Math.floor(parsed);
};

const startPickupLifecycleWorker = (): void => {
  if (env.NODE_ENV === 'test') {
    return;
  }

  const intervalMs = resolveOverdueSweepIntervalMs();
  const runSweep = async () => {
    try {
      const updated = await markOverduePickups();
      if (updated > 0) {
        console.log(`Marked ${updated} pickup(s) as overdue`);
      }
    } catch (err) {
      console.error('Pickup overdue sweep failed', err);
    }
  };

  void runSweep();
  const timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  timer.unref();
};

const start = async (): Promise<void> => {
  await initDb();
  startPickupLifecycleWorker();

  const server = app.listen(env.PORT, () => {
    console.log(`WasteTrack Backend listening on port ${env.PORT}`);
  });

  const SHUTDOWN_TIMEOUT_MS = 10_000;
  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down gracefully...`);

    const force = setTimeout(() => {
      console.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    server.close(async () => {
      try {
        await closeDb();
        console.log('Shutdown complete');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

void start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
