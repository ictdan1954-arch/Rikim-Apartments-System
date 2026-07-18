const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');

const announcementController = {
    async create(req, res) {
        try {
            const { apartment_id, title, message } = req.body;
            if (!apartment_id || !title) {
                return ApiResponse.badRequest(res, 'Apartment and title are required');
            }

            const { data, error } = await supabase
                .from('announcements')
                .insert([{ apartment_id, title, message, created_by: req.user.id }])
                .select('*')
                .single();

            if (error) throw error;
            return ApiResponse.created(res, data, 'Announcement created');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to create announcement');
        }
    },

    async getByApartment(req, res) {
        try {
            const { apartmentId } = req.params;
            const { data, error } = await supabase
                .from('announcements')
                .select('*, created_by_user:created_by(id, full_name)')
                .eq('apartment_id', apartmentId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return ApiResponse.success(res, data);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch announcements');
        }
    },

    async delete(req, res) {
        try {
            const { id } = req.params;
            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return ApiResponse.success(res, null, 'Announcement deleted');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to delete announcement');
        }
    }
};

module.exports = announcementController;
