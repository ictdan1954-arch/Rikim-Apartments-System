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

            // Send notification to receiver
            await supabase.from('notifications').insert([{
                user_id: receiver_id,
                title: 'New Message',
                message: `${req.user.role} sent you a message: "${message.trim().substring(0, 50)}..."`,
                type: 'general'
            }]);

            return ApiResponse.created(res, data, 'Message sent');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to send message');
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

            const { data, error } = await supabase
                .from('messages')
                .select('*, sender:sender_id(id, full_name, role), receiver:receiver_id(id, full_name, role)')
                .or(`and(sender_id.eq.${userId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${userId})`)
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .filter('deleted_by_sender', 'eq', false)
                .filter('deleted_by_receiver', 'eq', false)
                // Actually we need to filter: for messages where I'm sender, deleted_by_sender must be false;
                // for messages where I'm receiver, deleted_by_receiver must be false.
                // We can do this in JS after fetch for simplicity.
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Filter client-side
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
