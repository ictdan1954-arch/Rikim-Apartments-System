const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');
const { validateRequired } = require('../utils/validators');

const maintenanceController = {
    // Create maintenance request (tenant, caretaker, landlord)
    async create(req, res) {
        try {
            const { unit_id, apartment_id, title, description, priority } = req.body;
            const missing = validateRequired(req.body, ['unit_id', 'apartment_id', 'title']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            const { data: request, error } = await supabase
                .from('maintenance_requests')
                .insert([{
                    unit_id,
                    apartment_id,
                    reported_by: req.user.id,
                    title,
                    description: description || null,
                    priority: priority || 'medium'
                }])
                .select('*')
                .single();

            if (error) throw error;

            // Notify caretakers of that apartment
            const { data: caretakers } = await supabase
                .from('caretaker_assignments')
                .select('user_id')
                .eq('apartment_id', apartment_id)
                .eq('is_active', true);

            if (caretakers && caretakers.length > 0) {
                const notifications = caretakers.map(c => ({
                    user_id: c.user_id,
                    title: 'New Maintenance Request',
                    message: `${title} - reported by ${req.user.role}`,
                    type: 'maintenance_update',
                    link: `/maintenance?apartment=${apartment_id}`
                }));
                await supabase.from('notifications').insert(notifications);
            }

            // If a caretaker creates it, also notify landlord
            if (req.user.role === 'caretaker') {
                const { data: landlord } = await supabase
                    .from('users')
                    .select('id')
                    .eq('role', 'landlord')
                    .single();
                if (landlord) {
                    await supabase.from('notifications').insert([{
                        user_id: landlord.id,
                        title: 'New Maintenance Request by Caretaker',
                        message: `${title} - caretaker reported`,
                        type: 'maintenance_update',
                        link: `/maintenance?apartment=${apartment_id}`
                    }]);
                }
            }

            return ApiResponse.created(res, request, 'Maintenance request submitted successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to submit maintenance request');
        }
    },

    // Get maintenance requests for an apartment
    async getByApartment(req, res) {
        try {
            const { apartmentId } = req.params;
            const { status, priority, start_date, end_date } = req.query;

            let query = supabase
                .from('maintenance_requests')
                .select(`
                    *,
                    units:unit_id(id, unit_number),
                    reported_by_user:reported_by(id, full_name)
                `)
                .eq('apartment_id', apartmentId);

            if (status) query = query.eq('status', status);
            if (priority) query = query.eq('priority', priority);
            if (start_date) query = query.gte('date_reported', start_date);
            if (end_date) query = query.lte('date_reported', end_date);

            const { data: requests, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            return ApiResponse.success(res, requests);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch maintenance requests');
        }
    },

    // Get single maintenance request (with comments)
    async getById(req, res) {
        try {
            const { id } = req.params;

            const { data: request, error } = await supabase
                .from('maintenance_requests')
                .select(`
                    *,
                    units:unit_id(*),
                    reported_by_user:reported_by(id, full_name, phone),
                    comments:maintenance_comments(
                        id, comment, created_at,
                        user:user_id(id, full_name, role)
                    )
                `)
                .eq('id', id)
                .single();

            if (error || !request) {
                return ApiResponse.notFound(res, 'Maintenance request not found');
            }

            return ApiResponse.success(res, request);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch maintenance request');
        }
    },

    // Get tenant's own requests
    async getMyRequests(req, res) {
        try {
            const { data: requests, error } = await supabase
                .from('maintenance_requests')
                .select('*, units:unit_id(id, unit_number)')
                .eq('reported_by', req.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return ApiResponse.success(res, requests);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch your requests');
        }
    },

    // Update maintenance request
    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = {};

            const allowedFields = ['title', 'description', 'priority', 'status', 'assigned_to', 'cost_incurred', 'date_resolved'];
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            if (req.body.status === 'resolved') {
                updateData.date_resolved = new Date().toISOString().split('T')[0];
            }

            const { data: request, error } = await supabase
                .from('maintenance_requests')
                .update(updateData)
                .eq('id', id)
                .select('*, reported_by_user:reported_by(id, full_name)')
                .single();

            if (error) throw error;

            // Notify the reporter (tenant or caretaker) about status change
            if (req.body.status && request) {
                await supabase.from('notifications').insert([{
                    user_id: request.reported_by,
                    title: 'Maintenance Update',
                    message: `Your request "${request.title}" is now ${req.body.status}`,
                    type: 'maintenance_update'
                }]);
            }

            return ApiResponse.success(res, request, 'Maintenance request updated successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update maintenance request');
        }
    },

    // Escalate a request (notify landlord)
    async escalate(req, res) {
        try {
            const { id } = req.params;

            const { data: request, error: fetchError } = await supabase
                .from('maintenance_requests')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !request) return ApiResponse.notFound(res, 'Request not found');

            const { error } = await supabase
                .from('maintenance_requests')
                .update({ escalated: true, escalated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;

            // Notify landlord
            const { data: landlord } = await supabase
                .from('users')
                .select('id')
                .eq('role', 'landlord')
                .single();

            if (landlord) {
                await supabase.from('notifications').insert([{
                    user_id: landlord.id,
                    title: 'Maintenance Request Escalated',
                    message: `"${request.title}" has been escalated by caretaker`,
                    type: 'maintenance_update'
                }]);
            }

            return ApiResponse.success(res, { escalated: true }, 'Request escalated');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to escalate request');
        }
    },

    // Add comment
    async createComment(req, res) {
        try {
            const { request_id } = req.params;
            const { comment } = req.body;
            if (!comment || !comment.trim()) {
                return ApiResponse.badRequest(res, 'Comment is required');
            }

            const { data: newComment, error } = await supabase
                .from('maintenance_comments')
                .insert([{
                    request_id,
                    user_id: req.user.id,
                    comment: comment.trim()
                }])
                .select('*, user:user_id(id, full_name, role)')
                .single();

            if (error) throw error;

            // Notify the other participants
            const { data: request } = await supabase
                .from('maintenance_requests')
                .select('reported_by, apartment_id')
                .eq('id', request_id)
                .single();

            if (request) {
                // Notify the reporter if they didn't write the comment
                if (request.reported_by !== req.user.id) {
                    await supabase.from('notifications').insert([{
                        user_id: request.reported_by,
                        title: 'New Comment on Maintenance',
                        message: `${req.user.role} commented: "${comment.trim().substring(0, 50)}..."`,
                        type: 'maintenance_update'
                    }]);
                }

                // Notify caretakers (if the commenter is a tenant)
                if (req.user.role === 'tenant') {
                    const { data: caretakers } = await supabase
                        .from('caretaker_assignments')
                        .select('user_id')
                        .eq('apartment_id', request.apartment_id)
                        .eq('is_active', true);
                    if (caretakers) {
                        const notifs = caretakers.map(c => ({
                            user_id: c.user_id,
                            title: 'Tenant Comment on Maintenance',
                            message: `Tenant commented: "${comment.trim().substring(0, 50)}..."`,
                            type: 'maintenance_update'
                        }));
                        await supabase.from('notifications').insert(notifs);
                    }
                }
            }

            return ApiResponse.created(res, newComment, 'Comment added');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to add comment');
        }
    },

    // Get comments for a request
    async getComments(req, res) {
        try {
            const { request_id } = req.params;
            const { data: comments, error } = await supabase
                .from('maintenance_comments')
                .select('*, user:user_id(id, full_name, role)')
                .eq('request_id', request_id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return ApiResponse.success(res, comments);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch comments');
        }
    },

    // Delete maintenance request
    async delete(req, res) {
        try {
            const { id } = req.params;
            const { error } = await supabase.from('maintenance_requests').delete().eq('id', id);
            if (error) throw error;
            return ApiResponse.success(res, null, 'Maintenance request deleted');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to delete maintenance request');
        }
    }
};

module.exports = maintenanceController;
