const express = require('express');
const router = express.Router();
const cleaningController = require('../controllers/cleaning.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

// All cleaning routes require authentication
router.use(authenticate);

// =============================================
// TASKS
// =============================================
router.get('/tasks',              authorize('cleaner'), cleaningController.getMyTasks);
router.get('/tasks/today',        authorize('cleaner'), cleaningController.getTodayTasks);
router.get('/tasks/:id',          authorize('cleaner'), cleaningController.getTaskById);
router.put('/tasks/:id/status',   authorize('cleaner'), cleaningController.updateTaskStatus);
router.put('/tasks/:id/accept',   authorize('cleaner'), cleaningController.acceptMoveOutTask);

// =============================================
// TEAM VIEW (other cleaners in same apartment)
// =============================================
router.get('/team', authorize('cleaner'), cleaningController.getTeamView);

// =============================================
// SUPPLIES
// =============================================
router.get('/supplies',               authorize('cleaner'), cleaningController.getSupplies);
router.post('/supplies/request',      authorize('cleaner'), cleaningController.requestSupplies);
router.get('/supplies/requests',      authorize('cleaner'), cleaningController.getMySupplyRequests);

// =============================================
// SALARY HISTORY
// =============================================
router.get('/salaries', authorize('cleaner'), cleaningController.getMySalaryHistory);

// =============================================
// CARETAKER INFO (for chat)
// =============================================
router.get('/caretaker', authorize('cleaner'), cleaningController.getMyCaretaker);

// =============================================
// MESSAGES WITH CARETAKER
// =============================================
router.get('/messages',               authorize('cleaner'), cleaningController.getMessages);
router.post('/messages',              authorize('cleaner'), cleaningController.sendMessage);
router.put('/messages/:id/read',      authorize('cleaner'), cleaningController.markMessageRead);

// =============================================
// NOTIFICATIONS (optional, for built‑in alerts)
// =============================================
router.get('/notifications',          authorize('cleaner'), cleaningController.getNotifications);
router.put('/notifications/:id/read', authorize('cleaner'), cleaningController.markNotificationRead);
router.put('/notifications/read-all', authorize('cleaner'), cleaningController.markAllRead);

module.exports = router;
