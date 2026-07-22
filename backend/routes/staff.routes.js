const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

router.use(authenticate);

// =============================================
// STAFF ROLES (Landlord only)
// =============================================
router.post('/roles',   authorize('landlord'), staffController.createRole);
router.get('/roles',    authorize('landlord', 'caretaker'), staffController.getRoles);
router.put('/roles/:id', authorize('landlord'), staffController.updateRole);
router.delete('/roles/:id', authorize('landlord'), staffController.deleteRole);

// =============================================
// STAFF MEMBERS
// =============================================
router.post('/members', authorize('landlord', 'caretaker'), staffController.createMember);

// NEW: Lookup staff member by phone (used by frontend to get staff_role)
router.get('/members/by-phone/:phone', authorize('landlord', 'caretaker', 'staff'), staffController.getMemberByPhone);

// Accounts with status
router.get('/members/apartment/:apartmentId/accounts', authorize('landlord', 'caretaker'), staffController.getMembersWithAccounts);

// Members in a specific apartment
router.get('/members/apartment/:apartmentId', authorize('landlord', 'caretaker'), staffController.getMembers);

// Single member by ID
router.get('/members/:id',     authorize('landlord', 'caretaker'), staffController.getMemberById);
router.put('/members/:id',     authorize('landlord', 'caretaker'), staffController.updateMember);
router.delete('/members/:id',  authorize('landlord', 'caretaker'), staffController.deleteMember);

// =============================================
// STAFF USER ACCOUNTS
// =============================================
router.post('/accounts', authorize('landlord', 'caretaker'), staffController.createStaffAccount);

// =============================================
// STAFF SALARIES
// =============================================
router.post('/salaries',                   authorize('landlord', 'caretaker'), staffController.recordSalary);
router.get('/salaries/apartment/:apartmentId', authorize('landlord', 'caretaker'), staffController.getSalaries);
router.put('/salaries/:id',                authorize('landlord', 'caretaker'), staffController.updateSalary);
router.delete('/salaries/:id',             authorize('landlord'), staffController.deleteSalary);

module.exports = router;
