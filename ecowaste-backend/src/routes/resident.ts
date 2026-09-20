import { Router } from 'express';

import { requireAuth, requireRole } from '../middlewares/auth';
import {
  residentCreatePickup,
  residentCreateReport,
  residentListMyPickups,
  residentListMyReports,
  residentListMyRewards,
  residentReschedulePickup,
  residentCancelPickup,
  residentConfirmPickupCompletion,
  residentConfirmReportCleanup,
  residentCancelReport,
  residentCreateFeedback,
  residentGetPickupQuota,
} from '../controllers/residentController';
import {
  residentCreateSubscriptionRequest,
  residentListMySubscriptionRequests,
} from '../controllers/subscriptionRequestsController';

const router = Router();

router.use(requireAuth, requireRole('resident'));

router.get('/reports', residentListMyReports);
router.post('/reports', residentCreateReport);
router.patch('/reports/:id/cancel', residentCancelReport);
router.delete('/reports/:id', residentCancelReport);
router.post('/reports/:id/confirm-cleanup', residentConfirmReportCleanup);

router.get('/pickups', residentListMyPickups);
router.get('/pickups/quota', residentGetPickupQuota);
router.post('/pickups', residentCreatePickup);
router.patch('/pickups/:id/reschedule', residentReschedulePickup);
router.patch('/pickups/:id/cancel', residentCancelPickup);
router.post('/pickups/:id/confirm-completion', residentConfirmPickupCompletion);

router.get('/rewards', residentListMyRewards);

router.get('/subscription-requests', residentListMySubscriptionRequests);
router.post('/subscription-requests', residentCreateSubscriptionRequest);

router.post('/feedback', residentCreateFeedback);

export default router;
