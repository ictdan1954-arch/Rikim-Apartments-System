const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const authenticate = require('../middleware/auth.middleware');

router.use(authenticate);

// Broadcast route (must be before /:partnerId)
router.post('/broadcast', messageController.broadcast);

// Standard routes
router.post('/', messageController.send);
router.get('/conversations', messageController.getConversations);
router.get('/unread-count', messageController.getUnreadCount);
router.get('/:partnerId', messageController.getMessages);
router.delete('/:id', messageController.delete);

module.exports = router;
