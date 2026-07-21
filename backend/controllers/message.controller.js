const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');

const messageController = {
    // Send a message
    async send(req, res) {
        try {
            const { receiver_id, apartment_id, message } = req.body;
            if (!receiver_id || !message || !message.trim()) {
                return ApiResponse.badRequest(res, 'Receiver and message are required');
            }

            const { data, error } = await supabase
                .from('messages')
                .insert([{
                    sender_id: req.user.id,
                    receiver_id,
                    apartment_id: apartment_id || null,
                    message: message.trim()
                }])
                .select('*, sender:sender_id(id, full_name, role), receiver:receiver_id(id, full_name, role)')
                .single();

            if (error) throw error;

            // Send notification with link to the sender
            await supabase.from('notifications').insert([{
                user_id: receiver_id,
                title: 'New Message',
                message: `${req.user.role} sent you a message: "${message.trim().substring(0, 50)}..."`,
                type: 'general',
                link: `/messages?partner=${req.user.id}`
            }]);

            return ApiResponse.created(res, data, 'Message sent');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to send message');
        }
    },

    // Broadcast a message to multiple receivers (landlord → caretakers, caretaker → tenants)
    async broadcast(req, res) {
        try {
            const { role, apartment_id, message } = req.body;
            if (!role || !message || !message.trim()) {
                return ApiResponse.badRequest(res, 'Role and message are required');
            }

            let receivers = [];

            if (req.user.role === 'landlord') {
                if (role === 'caretaker') {
                    // Get all caretakers (optionally filtered by apartment)
                    let query = supabase.from('users').select('id, full_name').eq('role', 'caretaker').eq('is_active', true);
                    if (apartment_id) {
                        const { data: assignments } = await supabase
                            .from('caretaker_assignments')
                            .select('user_id')
                            .eq('apartment_id', apartment_id)
                            .eq('is_active', true);
                        const ids = assignments?.map(a => a.user_id) || [];
                        if (ids.length === 0) {
                            return ApiResponse.badRequest(res, 'No caretakers found for this apartment');
                        }
                        query = query.in('id', ids);
                    }
                    const { data: users } = await query;
                    receivers = users || [];
                } else {
                    return ApiResponse.badRequest(res, 'Landlord can only broadcast to caretakers');
                }
            } else if (req.user.role === 'caretaker') {
                if (role !== 'tenant') {
                    return ApiResponse.badRequest(res, 'Caretaker can only broadcast to tenants');
                }
                // Get the caretaker's assigned apartment(s)
                const { data: assignments } = await supabase
                    .from('caretaker_assignments')
                    .select('apartment_id')
                    .eq('user_id', req.user.id)
                    .eq('is_active', true);
                const aptIds = assignments?.map(a => a.apartment_id) || [];
                if (aptIds.length === 0) {
                    return ApiResponse.badRequest(res, 'No apartment assigned');
                }
                // Use the provided apartment_id or the first assigned
                const targetAptId = apartment_id || aptIds[0];
                if (!aptIds.includes(targetAptId)) {
                    return ApiResponse.forbidden(res, 'You can only message tenants in your assigned apartment');
                }
                // Get all active tenants in that apartment
                const { data: units } = await supabase
                    .from('units')
                    .select('id')
                    .eq('apartment_id', targetAptId);
                const unitIds = units?.map(u => u.id) || [];
                if (unitIds.length === 0) {
                    return ApiResponse.badRequest(res, 'No units found');
                }
                const { data: tenants } = await supabase
                    .from('tenants')
                    .select('user_id, full_name')
                    .eq('status', 'active')
                    .in('unit_id', unitIds);
                // Extract user IDs
                const userIds = tenants?.map(t => t.user_id).filter(Boolean) || [];
                if (userIds.length === 0) {
                    return ApiResponse.badRequest(res, 'No active tenants found');
                }
                receivers = userIds.map(id => ({ id, full_name: '' }));
            } else {
                return ApiResponse.forbidden(res, 'Broadcast not allowed for this role');
            }

            if (receivers.length === 0) {
                return ApiResponse.badRequest(res, 'No receivers found');
            }

            // Create a message for each receiver
            const messagesToInsert = receivers.map(r => ({
                sender_id: req.user.id,
                receiver_id: r.id,
                apartment_id: apartment_id || null,
                message: message.trim()
            }));

            const { error } = await supabase.from('messages').insert(messagesToInsert);

            if (error) throw error;

            // Send notifications to all receivers
            const notifications = receivers.map(r => ({
                user_id: r.id,
                title: `Broadcast from ${req.user.role}`,
                message: message.trim().substring(0, 100),
                type: 'general',
                link: `/messages?partner=${req.user.id}`
            }));
            await supabase.from('notifications').insert(notifications);

            return ApiResponse.created(res, { count: receivers.length }, `Message sent to ${receivers.length} ${role}(s)`);
        } catch (error) {
            console.error('Broadcast error:', error);
            return ApiResponse.error(res, 'Failed to broadcast message');
        }
    },

    // Get conversations for current user (list of distinct users with last message)
    async getConversations(req, res) {
        try {
            const userId = req.user.id;

            // Get all messages where user is sender or receiver, not deleted by this user
            const { data: sent, error: sentError } = await supabase
                .from('messages')
                .select('receiver_id, receiver:receiver_id(id, full_name, role), message, created_at')
                .eq('sender_id', userId)
                .eq('deleted_by_sender', false)
                .order('created_at', { ascending: false });

            const { data: received, error: recError } = await supabase
                .from('messages')
                .select('sender_id, sender:sender_id(id, full_name, role), message, created_at')
                .eq('receiver_id', userId)
                .eq('deleted_by_receiver', false)
                .order('created_at', { ascending: false });

            if (sentError || recError) throw sentError || recError;

            // Build a map of conversation partner -> last message
            const conversations = {};

            sent.forEach(m => {
                const partnerId = m.receiver_id;
                if (!conversations[partnerId] || new Date(m.created_at) > new Date(conversations[partnerId].created_at)) {
                    conversations[partnerId] = {
                        user: m.receiver,
                        last_message: m.message,
                        last_message_time: m.created_at,
                        direction: 'sent'
                    };
                }
            });

            received.forEach(m => {
                const partnerId = m.sender_id;
                if (!conversations[partnerId] || new Date(m.created_at) > new Date(conversations[partnerId].created_at)) {
                    conversations[partnerId] = {
                        user: m.sender,
                        last_message: m.message,
                        last_message_time: m.created_at,
                        direction: 'received'
                    };
                }
            });

            // Convert to array and sort by last message time
            const result = Object.keys(conversations).map(key => ({
                user_id: key,
                ...conversations[key]
            })).sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

            return ApiResponse.success(res, result);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch conversations');
        }
    },

    // Get messages between current user and another user
    async getMessages(req, res) {
        try {
            const { partnerId } = req.params;
            const userId = req.user.id;

            // Fetch all messages where the two users are involved, ignoring deleted flags for now
            const { data, error } = await supabase
                .from('messages')
                .select('*, sender:sender_id(id, full_name, role), receiver:receiver_id(id, full_name, role)')
                .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Client-side filter to hide messages deleted by the current user
            const filtered = data.filter(m => {
                if (m.sender_id === userId && m.deleted_by_sender) return false;
                if (m.receiver_id === userId && m.deleted_by_receiver) return false;
                return true;
            });

            // Mark unread messages from partner as read
            const unreadIds = filtered
                .filter(m => m.receiver_id === userId && !m.is_read)
                .map(m => m.id);

            if (unreadIds.length > 0) {
                await supabase
                    .from('messages')
                    .update({ is_read: true })
                    .in('id', unreadIds);
            }

            return ApiResponse.success(res, filtered);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch messages');
        }
    },

    // Delete a message (soft delete for the current user)
    async delete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Get the message
            const { data: message, error: fetchError } = await supabase
                .from('messages')
                .select('sender_id, receiver_id')
                .eq('id', id)
                .single();

            if (fetchError || !message) {
                return ApiResponse.notFound(res, 'Message not found');
            }

            const updateField = message.sender_id === userId ? 'deleted_by_sender' : 'deleted_by_receiver';
            const { error } = await supabase
                .from('messages')
                .update({ [updateField]: true })
                .eq('id', id);

            if (error) throw error;

            return ApiResponse.success(res, null, 'Message deleted');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to delete message');
        }
    },

    // Get unread count
    async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;
            const { count, error } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', userId)
                .eq('is_read', false)
                .eq('deleted_by_receiver', false);

            if (error) throw error;

            return ApiResponse.success(res, { count: count || 0 });
        } catch (error) {
            return ApiResponse.error(res, 'Failed to get unread count');
        }
    }
};

module.exports = messageController;
