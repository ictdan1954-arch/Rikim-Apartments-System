const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');

// Public routes
router.post('/register', authenticate, authController.register); // Requires auth to control who creates whom
router.post('/login', authController.login);

// Special: First landlord registration (no auth required)
router.post('/setup', async (req, res) => {
    // Check if any landlord exists
    const supabase = require('../config/supabase');
    const { data: existingLandlord } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'landlord')
        .maybeSingle();

    if (existingLandlord) {
        return res.status(400).json({ success: false, message: 'System already set up. Contact landlord.' });
    }

    req.body.role = 'landlord';
    return authController.register(req, res);
});

// Protected routes
router.get('/profile', authenticate, authController.getProfile);
router.get('/users', authenticate, authorize('landlord'), authController.getAllUsers);

module.exports = router;
