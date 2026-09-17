import { Router } from 'express';

import { requireAuth } from '../middlewares/auth';
import {
  listMyNotifications,
  markMyNotificationRead,
  markMyNotificationsReadAll,
} from '../controllers/notificationsController';

const router = Router();

router.use(requireAuth);

router.get('/', listMyNotifications);
router.post('/read-all', markMyNotificationsReadAll);
router.post('/:id/read', markMyNotificationRead);

export default router;
