const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expense.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

router.use(authenticate);

router.post('/', authorize('landlord', 'caretaker'), expenseController.create);
router.get('/apartment/:apartmentId', authorize('landlord', 'caretaker'), expenseController.getByApartment);
router.get('/apartment/:apartmentId/summary', authorize('landlord', 'caretaker'), expenseController.getSummary);
router.get('/:id', authorize('landlord', 'caretaker'), expenseController.getById);
router.put('/:id', authorize('landlord', 'caretaker'), expenseController.update);
router.delete('/:id', authorize('landlord'), expenseController.delete);

module.exports = router;
