import { Router } from 'express';

import { requireAuth } from '../middlewares/auth';
import {
  listCollectorLocations,
  listNeighborhoods,
  trackMyLocation,
} from '../controllers/locationController';

const router = Router();

router.get('/neighborhoods', listNeighborhoods);
router.post('/track', requireAuth, trackMyLocation);
router.get('/collectors', requireAuth, listCollectorLocations);

export default router;
