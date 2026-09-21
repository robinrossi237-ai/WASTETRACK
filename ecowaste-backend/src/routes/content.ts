import { Router } from 'express';

import { listPublicContent, listPublicTestimonialsHandler } from '../controllers/contentController';

const router = Router();

router.get('/', listPublicContent);
router.get('/testimonials', listPublicTestimonialsHandler);

export default router;
