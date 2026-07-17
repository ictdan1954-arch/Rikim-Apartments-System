const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unit.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');
const checkApartmentAccess = require('../middleware/apartment.middleware');

router.use(authenticate);

router.post('/', authorize('landlord', 'caretaker'), checkApartmentAccess, unitController.create);
router.get('/apartment/:apartmentId', authorize('landlord', 'caretaker'), checkApartmentAccess, unitController.getByApartment);
router.get('/:id', authorize('landlord', 'caretaker', 'tenant'), unitController.getById);
router.put('/:id', authorize('landlord', 'caretaker'), unitController.update);
router.delete('/:id', authorize('landlord'), unitController.delete);

module.exports = router;
