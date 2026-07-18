const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

router.use(authenticate);

router.get('/landlord', authorize('landlord'), dashboardController.landlordDashboard);
router.get('/caretaker', authorize('caretaker'), dashboardController.caretakerDashboard);
router.get('/tenant', authorize('tenant'), dashboardController.tenantDashboard);
router.get('/staff', authorize('staff'), dashboardController.staffDashboard);

module.exports = router;
