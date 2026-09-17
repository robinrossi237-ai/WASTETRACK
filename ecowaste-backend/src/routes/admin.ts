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
import { adminListFeedback } from '../controllers/adminFeedbackController';
import { adminListCollectorRanking } from '../controllers/adminCollectorRankingController';

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
router.get('/collector-ranking', adminListCollectorRanking);

router.get('/content', adminListContent);
router.post('/content', adminCreateContent);
router.patch('/content/:id', adminUpdateContent);
router.delete('/content/:id', adminDeleteContent);

router.get('/audit', adminListAuditLogs);
router.post('/notifications/broadcast', adminBroadcastNotification);

export default router;
