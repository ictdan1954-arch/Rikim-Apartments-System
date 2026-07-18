const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

router.use(authenticate);

// Staff Roles (Landlord only)
router.post('/roles', authorize('landlord'), staffController.createRole);
router.get('/roles', authorize('landlord', 'caretaker'), staffController.getRoles);
router.delete('/roles/:id', authorize('landlord'), staffController.deleteRole);

// Staff Members
router.post('/members', authorize('landlord', 'caretaker'), staffController.createMember);
router.get('/members/apartment/:apartmentId', authorize('landlord', 'caretaker'), staffController.getMembers);
router.get('/members/:id', authorize('landlord', 'caretaker'), staffController.getMemberById);
router.put('/members/:id', authorize('landlord', 'caretaker'), staffController.updateMember);
router.delete('/members/:id', authorize('landlord', 'caretaker'), staffController.deleteMember);

// Staff User Accounts (create login for staff members)
router.post('/accounts', authorize('landlord', 'caretaker'), staffController.createStaffAccount);

// Staff Salaries
router.post('/salaries', authorize('landlord', 'caretaker'), staffController.recordSalary);
router.get('/salaries/apartment/:apartmentId', authorize('landlord', 'caretaker'), staffController.getSalaries);
router.delete('/salaries/:id', authorize('landlord'), staffController.deleteSalary);

module.exports = router;
