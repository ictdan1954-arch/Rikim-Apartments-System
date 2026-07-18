const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');

const notificationController = {
    // Get notifications for current user
    async getNotifications(req, res) {
        try {
            const { data: notifications, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', req.user.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            return ApiResponse.success(res, notifications);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch notifications');
        }
    },

    // Mark a single notification as read
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id)
                .eq('user_id', req.user.id);

            if (error) throw error;

            return ApiResponse.success(res, null, 'Notification marked as read');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update notification');
        }
    },

    // Mark all notifications as read
    async markAllAsRead(req, res) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', req.user.id)
                .eq('is_read', false);

            if (error) throw error;

            return ApiResponse.success(res, null, 'All notifications marked as read');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update notifications');
        }
    },

    // Create notification (usually called by other controllers)
    async create(data) {
        try {
            const { error } = await supabase.from('notifications').insert(data);
            if (error) console.error('Notification creation error:', error);
        } catch (e) {
            console.error('Notification creation failed:', e);
        }
    }
};

module.exports = notificationController;
