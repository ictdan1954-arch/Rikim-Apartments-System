const express = require('express');
const router = express.Router();
const apartmentController = require('../controllers/apartment.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

router.use(authenticate);

// Landlord routes
router.post('/', authorize('landlord'), apartmentController.create);
router.put('/:id', authorize('landlord'), apartmentController.update);
router.delete('/:id', authorize('landlord'), apartmentController.delete);
router.post('/:apartmentId/caretakers', authorize('landlord'), apartmentController.assignCaretaker);
router.get('/:apartmentId/caretakers', authorize('landlord', 'caretaker', 'tenant'), apartmentController.getCaretakers);
router.delete('/caretakers/:assignmentId', authorize('landlord'), apartmentController.removeCaretaker);

// All authenticated users
router.get('/', apartmentController.getAll);
router.get('/:id', apartmentController.getById);

module.exports = router;
