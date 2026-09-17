import { Router } from 'express';

import { requireAuth } from '../middlewares/auth';
import { registerMyPushToken, unregisterMyPushToken } from '../controllers/pushTokensController';

const router = Router();

router.use(requireAuth);

router.post('/', registerMyPushToken);
router.delete('/:token', unregisterMyPushToken);

export default router;
