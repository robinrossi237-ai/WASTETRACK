import { Router } from 'express';

import { requireAuth, requireRole } from '../middlewares/auth';
import {
  collectorAcceptOffer,
  collectorCompleteAssignment,
  collectorCleanReport,
  collectorGetAssignment,
  collectorGetReport,
  collectorListPendingOffers,
  collectorListAssigned,
  collectorListAssignedReports,
  collectorListHistory,
  collectorListReportHistory,
  collectorRejectOffer,
  collectorStartAssignment,
  collectorReportIssue,
  collectorReportWasteReportIssue,
  collectorSwitchRole,
} from '../controllers/collectorController';

const router = Router();

router.use(requireAuth, requireRole('collector'));

router.get('/offers/pending', collectorListPendingOffers);
router.post('/offers/:id/accept', collectorAcceptOffer);
router.post('/offers/:id/reject', collectorRejectOffer);

router.get('/pickups/assigned', collectorListAssigned);
router.get('/pickups/history', collectorListHistory);
router.get('/pickups/:id', collectorGetAssignment);
router.post('/pickups/:id/start', collectorStartAssignment);
router.post('/pickups/:id/complete', collectorCompleteAssignment);
router.post('/pickups/:id/issue', collectorReportIssue);

router.get('/reports/assigned', collectorListAssignedReports);
router.get('/reports/history', collectorListReportHistory);
router.get('/reports/:id', collectorGetReport);
router.post('/reports/:id/clean', collectorCleanReport);
router.post('/reports/:id/issue', collectorReportWasteReportIssue);

router.post('/switch-role', collectorSwitchRole);

export default router;
