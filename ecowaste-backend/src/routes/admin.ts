import { Router } from 'express';

import { requireAuth, requireRole } from '../middlewares/auth';
import { getStats } from '../controllers/adminStatsController';
import {
  adminDeleteUser,
  adminListCollectorApplications,
  adminListCollectors,
  adminListUsers,
  adminReviewCollectorApplication,
  adminSetUserActive,
  adminSetUserPlan,
} from '../controllers/adminUsersController';
import {
  adminAssignReportCollector,
  adminListReports,
  adminSignalNearestCollectorsForReport,
  adminUpdateReportStatus,
} from '../controllers/adminReportsController';
import { adminListPickups, adminUpdatePickupStatus } from '../controllers/adminPickupsController';
import {
  adminCreateAssignment,
  adminListAssignments,
} from '../controllers/adminAssignmentsController';
import { adminGrantReward, adminListRewards } from '../controllers/adminRewardsController';
import {
  adminCreateContent,
  adminDeleteContent,
  adminListContent,
  adminUpdateContent,
} from '../controllers/adminContentController';
import { adminListAuditLogs } from '../controllers/adminAuditController';
import { adminBroadcastNotification } from '../controllers/adminNotificationsController';
import { adminListFeedback, adminSetFeedbackVisibility } from '../controllers/adminFeedbackController';
import { adminListCollectorRanking } from '../controllers/adminCollectorRankingController';
import {
  adminCreatePlan,
  adminDeletePlan,
  adminGetPlan,
  adminListPlans,
  adminUpdatePlan,
} from '../controllers/plansController';
import {
  adminListSubscriptionRequests,
  adminReviewSubscriptionRequest,
} from '../controllers/subscriptionRequestsController';
import { adminGetPaymentSettings, adminUpdatePaymentSettings } from '../controllers/pricingController';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/stats', getStats);

router.get('/users', adminListUsers);
router.patch('/users/:id', adminSetUserActive);
router.patch('/users/:id/plan', adminSetUserPlan);
router.delete('/users/:id', adminDeleteUser);
router.get('/collectors', adminListCollectors);
router.get('/collector-applications', adminListCollectorApplications);
router.patch('/collector-applications/:id', adminReviewCollectorApplication);

router.get('/reports', adminListReports);
router.patch('/reports/:id', adminUpdateReportStatus);
router.post('/reports/:id/assign', adminAssignReportCollector);
router.post('/reports/:id/signal-nearest', adminSignalNearestCollectorsForReport);

router.get('/pickups', adminListPickups);
router.patch('/pickups/:id', adminUpdatePickupStatus);

router.get('/assignments', adminListAssignments);
router.post('/assignments', adminCreateAssignment);

router.get('/rewards', adminListRewards);
router.post('/rewards', adminGrantReward);

router.get('/feedback', adminListFeedback);
router.patch('/feedback/:id/visibility', adminSetFeedbackVisibility);
router.get('/collector-ranking', adminListCollectorRanking);

router.get('/content', adminListContent);
router.post('/content', adminCreateContent);
router.patch('/content/:id', adminUpdateContent);
router.delete('/content/:id', adminDeleteContent);

router.get('/audit', adminListAuditLogs);
router.post('/notifications/broadcast', adminBroadcastNotification);

router.get('/plans', adminListPlans);
router.post('/plans', adminCreatePlan);
router.get('/plans/:id', adminGetPlan);
router.patch('/plans/:id', adminUpdatePlan);
router.delete('/plans/:id', adminDeletePlan);

router.get('/subscription-requests', adminListSubscriptionRequests);
router.patch('/subscription-requests/:id/review', adminReviewSubscriptionRequest);

router.patch('/payment-settings', adminUpdatePaymentSettings);
router.get('/payment-settings', adminGetPaymentSettings);

export default router;
