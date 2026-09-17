import { Router } from 'express';

import { publicListLeaderboard } from '../controllers/leaderboardController';

const router = Router();

router.get('/', publicListLeaderboard);

export default router;
