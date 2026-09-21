import { Router } from 'express';

import { changePassword, login, register, updateMe } from '../controllers/authController';
import { requireAuth } from '../middlewares/auth';
import { authRateLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});
router.patch('/me', requireAuth, updateMe);
router.patch('/password', authRateLimiter, requireAuth, changePassword);

export default router;
