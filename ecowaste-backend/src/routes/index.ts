import { Router } from 'express';

import { env } from '../config/env';
import { pingDb } from '../config/db';
import authRoutes from './auth';
import adminRoutes from './admin';
import notificationsRoutes from './notifications';
import residentRoutes from './resident';
import collectorRoutes from './collector';
import contentRoutes from './content';
import leaderboardRoutes from './leaderboard';
import locationRoutes from './location';
import pricingRoutes from './pricing';
import realtimeRoutes from './realtime';
import pushTokenRoutes from './pushTokens';
import uploadsRoutes from './uploads';

const router = Router();

router.get('/api/health', async (_req, res) => {
  const started = Date.now();
  try {
    await pingDb();
    res.status(200).json({
      status: 'OK',
      service: 'WasteTrack Backend',
      db: 'UP',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    res.status(503).json({
      status: 'DEGRADED',
      service: 'WasteTrack Backend',
      db: 'DOWN',
      timestamp: new Date().toISOString(),
      message: env.NODE_ENV === 'production' ? undefined : (err as Error).message,
    });
  }
});

router.use('/api/auth', authRoutes);
router.use('/api/admin', adminRoutes);
router.use('/api/notifications', notificationsRoutes);
router.use('/api/resident', residentRoutes);
router.use('/api/collector', collectorRoutes);
router.use('/api/content', contentRoutes);
router.use('/api/leaderboard', leaderboardRoutes);
router.use('/api/location', locationRoutes);
router.use('/api/pricing', pricingRoutes);
router.use('/api/realtime', realtimeRoutes);
router.use('/api/push-tokens', pushTokenRoutes);
router.use('/api/uploads', uploadsRoutes);

export default router;
