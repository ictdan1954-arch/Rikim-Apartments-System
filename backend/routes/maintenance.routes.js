const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

router.use(authenticate);

// Create request (tenant, caretaker, landlord)
router.post('/', authorize('landlord', 'caretaker', 'tenant'), maintenanceController.create);

// List by apartment
router.get('/apartment/:apartmentId', authorize('landlord', 'caretaker'), maintenanceController.getByApartment);

// Tenant's own requests
router.get('/my-requests', authorize('tenant'), maintenanceController.getMyRequests);

// Comments – must come before the /:id routes
router.get('/:id/comments', authorize('landlord', 'caretaker', 'tenant'), maintenanceController.getComments);
router.post('/:id/comments', authorize('landlord', 'caretaker', 'tenant'), maintenanceController.createComment);

// Single request
router.get('/:id', authorize('landlord', 'caretaker', 'tenant'), maintenanceController.getById);

// Update request
router.put('/:id', authorize('landlord', 'caretaker'), maintenanceController.update);

// Escalate
router.put('/:id/escalate', authorize('caretaker'), maintenanceController.escalate);

// Delete
router.delete('/:id', authorize('landlord'), maintenanceController.delete);

module.exports = router;
