import { Router } from 'express';

import { streamRealtimeEvents } from '../controllers/realtimeController';

const router = Router();

router.get('/stream', streamRealtimeEvents);

export default router;
