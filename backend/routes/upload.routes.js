// backend/routes/upload.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const authenticate = require('../middleware/auth.middleware');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

router.use(authenticate);

router.post('/profile-photo', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

        const fileName = `avatars/${req.user.id}_${Date.now()}.${req.file.originalname.split('.').pop()}`;
        const { data, error } = await supabaseClient.storage
            .from('avatars')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (error) throw error;

        // Get public URL
        const { publicURL } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);

        // Update user's profile_photo in database
        const supabaseAdmin = require('../config/supabase');
        await supabaseAdmin.from('users')
            .update({ profile_photo: publicURL })
            .eq('id', req.user.id);

        return res.status(200).json({ success: true, data: { url: publicURL } });
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ success: false, message: 'Upload failed' });
    }
});

module.exports = router;
