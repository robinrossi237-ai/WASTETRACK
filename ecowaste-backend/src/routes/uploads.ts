import { Router } from 'express';

import { requireAuth } from '../middlewares/auth';
import { createUpload } from '../controllers/uploadsController';

const router = Router();

router.use(requireAuth);
router.post('/', createUpload);

export default router;
