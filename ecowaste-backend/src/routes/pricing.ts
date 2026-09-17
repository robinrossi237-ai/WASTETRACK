import { Router } from 'express';

import { getPublicPricingSettings } from '../controllers/pricingController';

const router = Router();

router.get('/', getPublicPricingSettings);

export default router;
