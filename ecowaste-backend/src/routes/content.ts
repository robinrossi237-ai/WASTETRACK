import { Router } from 'express';

import { listPublicContent } from '../controllers/contentController';

const router = Router();

router.get('/', listPublicContent);

export default router;
