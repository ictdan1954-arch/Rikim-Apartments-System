const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');

// Helper: get staff record from phone (reusable)
async function getStaffRecord(phone) {
    const { data, error } = await supabase
        .from('staff_members')
        .select('id, apartment_id')
        .eq('phone', phone)
        .maybeSingle();
    if (error || !data) return null;
    return { staff_id: data.id, apartment_id: data.apartment_id };
}

const cleaningController = {
    // =============================================
    // GET MY TASKS
    // =============================================
    async getMyTasks(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { staff_id } = staff;
            const { status, date_from, date_to } = req.query;

            let query = supabase
                .from('cleaning_tasks')
                .select(`
                    *,
                    units:unit_id(unit_number),
                    apartments:apartment_id(name),
                    assigned_by_user:assigned_by(full_name)
                `)
                .eq('cleaner_id', staff_id);

            if (status) query = query.eq('status', status);
            if (date_from) query = query.gte('date_assigned', date_from);
            if (date_to) query = query.lte('date_assigned', date_to);

            const { data: tasks, error } = await query.order('due_date', { ascending: true });

            if (error) throw error;

            return ApiResponse.success(res, tasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            return ApiResponse.error(res, 'Failed to fetch tasks');
        }
    },

    // =============================================
    // GET TODAY'S TASKS
    // =============================================
    async getTodayTasks(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { staff_id } = staff;
            const today = new Date().toISOString().split('T')[0];

            const { data: tasks, error } = await supabase
                .from('cleaning_tasks')
                .select(`
                    *,
                    units:unit_id(unit_number),
                    apartments:apartment_id(name),
                    assigned_by_user:assigned_by(full_name)
                `)
                .eq('cleaner_id', staff_id)
                .eq('date_assigned', today)
                .in('status', ['pending', 'in_progress'])
                .order('due_time', { ascending: true });

            if (error) throw error;

            const { count: completedCount, error: countError } = await supabase
                .from('cleaning_tasks')
                .select('*', { count: 'exact', head: true })
                .eq('cleaner_id', staff_id)
                .eq('date_assigned', today)
                .eq('status', 'completed');

            if (countError) throw countError;

            return ApiResponse.success(res, {
                tasks: tasks || [],
                completed: completedCount || 0,
                total: (tasks?.length || 0) + (completedCount || 0)
            });
        } catch (error) {
            console.error('Error fetching today\'s tasks:', error);
            return ApiResponse.error(res, 'Failed to fetch tasks');
        }
    },

    // =============================================
    // GET TASK BY ID
    // =============================================
    async getTaskById(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { id } = req.params;
            const { data: task, error } = await supabase
                .from('cleaning_tasks')
                .select(`
                    *,
                    units:unit_id(unit_number),
                    apartments:apartment_id(name),
                    assigned_by_user:assigned_by(full_name)
                `)
                .eq('id', id)
                .eq('cleaner_id', staff.staff_id)
                .single();

            if (error || !task) return ApiResponse.notFound(res, 'Task not found');

            return ApiResponse.success(res, task);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch task');
        }
    },

    // =============================================
    // UPDATE TASK STATUS
    // =============================================
    async updateTaskStatus(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { id } = req.params;
            const { status, notes } = req.body;
            const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return ApiResponse.badRequest(res, 'Invalid status');
            }

            const updateData = { status, updated_at: new Date().toISOString() };
            if (status === 'completed') {
                updateData.completed_at = new Date().toISOString();
            }

            const { data: task, error } = await supabase
                .from('cleaning_tasks')
                .update(updateData)
                .eq('id', id)
                .eq('cleaner_id', staff.staff_id)
                .select('*')
                .single();

            if (error || !task) return ApiResponse.notFound(res, 'Task not found');

            return ApiResponse.success(res, task, 'Task status updated');
        } catch (error) {
            console.error('Error updating task:', error);
            return ApiResponse.error(res, 'Failed to update task');
        }
    },

    // =============================================
    // ACCEPT MOVE-OUT TASK
    // =============================================
    async acceptMoveOutTask(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { id } = req.params;
            const { data: task, error } = await supabase
                .from('cleaning_tasks')
                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                .eq('id', id)
                .eq('cleaner_id', staff.staff_id)
                .eq('status', 'pending')
                .select('*')
                .single();

            if (error || !task) return ApiResponse.notFound(res, 'Task not found or already accepted');

            return ApiResponse.success(res, task, 'Move-out cleaning accepted');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to accept move-out task');
        }
    },

    // =============================================
    // GET TEAM VIEW
    // =============================================
    async getTeamView(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { staff_id, apartment_id } = staff;
            const { data: team, error } = await supabase
                .from('staff_members')
                .select(`
                    id,
                    full_name,
                    phone,
                    status,
                    staff_roles:staff_role_id(role_name)
                `)
                .eq('apartment_id', apartment_id)
                .neq('id', staff_id);

            if (error) throw error;

            const cleaners = team?.filter(m => m.staff_roles?.role_name === 'cleaner') || [];
            const today = new Date().toISOString().split('T')[0];
            const teamWithTasks = await Promise.all(cleaners.map(async (member) => {
                const { data: tasks } = await supabase
                    .from('cleaning_tasks')
                    .select('status, id')
                    .eq('cleaner_id', member.id)
                    .eq('date_assigned', today);

                const total = tasks?.length || 0;
                const completed = tasks?.filter(t => t.status === 'completed').length || 0;
                const inProgress = tasks?.filter(t => t.status === 'in_progress').length || 0;

                return { ...member, tasks_today: { total, completed, inProgress } };
            }));

            return ApiResponse.success(res, teamWithTasks);
        } catch (error) {
            console.error('Error fetching team view:', error);
            return ApiResponse.error(res, 'Failed to fetch team');
        }
    },

    // =============================================
    // GET SUPPLIES
    // =============================================
    async getSupplies(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { data: supplies, error } = await supabase
                .from('cleaning_supplies')
                .select('*')
                .eq('apartment_id', staff.apartment_id)
                .order('item_name');

            if (error) throw error;

            const suppliesWithStatus = supplies?.map(item => ({
                ...item,
                is_low: item.quantity <= item.min_quantity
            })) || [];

            return ApiResponse.success(res, suppliesWithStatus);
        } catch (error) {
            console.error('Error fetching supplies:', error);
            return ApiResponse.error(res, 'Failed to fetch supplies');
        }
    },

    // =============================================
    // REQUEST SUPPLIES
    // =============================================
    async requestSupplies(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { supply_item_id, item_name, requested_quantity, notes } = req.body;
            if (!item_name || !requested_quantity) {
                return ApiResponse.badRequest(res, 'Item name and quantity are required');
            }

            const { data: request, error } = await supabase
                .from('supply_requests')
                .insert([{
                    cleaner_id: staff.staff_id,
                    apartment_id: staff.apartment_id,
                    supply_item_id: supply_item_id || null,
                    item_name,
                    requested_quantity,
                    notes: notes || null
                }])
                .select('*')
                .single();

            if (error) throw error;

            return ApiResponse.created(res, request, 'Supply request submitted');
        } catch (error) {
            console.error('Error requesting supplies:', error);
            return ApiResponse.error(res, 'Failed to submit supply request');
        }
    },

    // =============================================
    // GET MY SUPPLY REQUESTS
    // =============================================
    async getMySupplyRequests(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { data: requests, error } = await supabase
                .from('supply_requests')
                .select(`
                    *,
                    approved_by_user:approved_by(full_name)
                `)
                .eq('cleaner_id', staff.staff_id)
                .order('requested_date', { ascending: false });

            if (error) throw error;

            return ApiResponse.success(res, requests || []);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch supply requests');
        }
    },

    // =============================================
    // GET MY SALARY HISTORY
    // =============================================
    async getMySalaryHistory(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { data: salaries, error } = await supabase
                .from('staff_salaries')
                .select(`
                    *,
                    recorded_by_user:recorded_by(full_name)
                `)
                .eq('staff_id', staff.staff_id)
                .order('payment_date', { ascending: false });

            if (error) throw error;

            const totalPaid = salaries?.reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0) || 0;

            return ApiResponse.success(res, {
                salaries: salaries || [],
                total_paid: totalPaid,
                count: salaries?.length || 0
            });
        } catch (error) {
            console.error('Error fetching salary:', error);
            return ApiResponse.error(res, 'Failed to fetch salary history');
        }
    },

    // =============================================
    // GET MY CARETAKER
    // =============================================
    async getMyCaretaker(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { data: caretakers, error } = await supabase
                .from('caretaker_assignments')
                .select('user_id, users:user_id(full_name)')
                .eq('apartment_id', staff.apartment_id)
                .eq('is_active', true)
                .limit(1);

            if (error) throw error;

            const caretaker = caretakers?.[0] || null;
            return ApiResponse.success(res, caretaker);
        } catch (error) {
            console.error('Error fetching caretaker:', error);
            return ApiResponse.error(res, 'Failed to fetch caretaker');
        }
    },

    // =============================================
    // GET NOTIFICATIONS (unchanged, uses staff_id from token if present, but we adapt)
    // =============================================
    async getNotifications(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { unread_only } = req.query;
            let query = supabase
                .from('cleaner_notifications')
                .select('*')
                .eq('cleaner_id', staff.staff_id);

            if (unread_only === 'true') query = query.eq('is_read', false);

            const { data: notifications, error } = await query
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            return ApiResponse.success(res, notifications || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return ApiResponse.error(res, 'Failed to fetch notifications');
        }
    },

    async markNotificationRead(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { id } = req.params;
            const { error } = await supabase
                .from('cleaner_notifications')
                .update({ is_read: true })
                .eq('id', id)
                .eq('cleaner_id', staff.staff_id);

            if (error) throw error;
            return ApiResponse.success(res, null, 'Notification marked as read');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to mark notification read');
        }
    },

    async markAllRead(req, res) {
        try {
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            const { error } = await supabase
                .from('cleaner_notifications')
                .update({ is_read: true })
                .eq('cleaner_id', staff.staff_id)
                .eq('is_read', false);

            if (error) throw error;
            return ApiResponse.success(res, null, 'All notifications marked as read');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to mark all as read');
        }
    },

    // =============================================
    // MESSAGES
    // =============================================
    async getMessages(req, res) {
        try {
            const userId = req.user.id;
            const staff = await getStaffRecord(req.user.phone);
            if (!staff) return ApiResponse.notFound(res, 'Staff record not found');

            // Get caretakers for the same apartment (using staff_role_id or whatever)
            const { data: caretakers } = await supabase
                .from('staff_members')
                .select('user_id')
                .eq('apartment_id', staff.apartment_id)
                .eq('staff_role_id', 2); // assuming 2 = caretaker, adjust if needed

            const caretakerIds = caretakers?.map(c => c.user_id).filter(id => id) || [];

            const { data: messages, error } = await supabase
                .from('cleaner_messages')
                .select(`
                    *,
                    sender:sender_id(full_name),
                    receiver:receiver_id(full_name)
                `)
                .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return ApiResponse.success(res, messages || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
            return ApiResponse.error(res, 'Failed to fetch messages');
        }
    },

    async sendMessage(req, res) {
        try {
            const { receiver_id, message } = req.body;
            const sender_id = req.user.id;

            if (!receiver_id || !message) {
                return ApiResponse.badRequest(res, 'Receiver and message are required');
            }

            const { data: sent, error } = await supabase
                .from('cleaner_messages')
                .insert([{ sender_id, receiver_id, message, is_read: false }])
                .select('*, sender:sender_id(full_name), receiver:receiver_id(full_name)')
                .single();

            if (error) throw error;
            return ApiResponse.created(res, sent, 'Message sent');
        } catch (error) {
            console.error('Error sending message:', error);
            return ApiResponse.error(res, 'Failed to send message');
        }
    },

    async markMessageRead(req, res) {
        try {
            const { id } = req.params;
            const cleanerId = req.user.id;

            const { error } = await supabase
                .from('cleaner_messages')
                .update({ is_read: true })
                .eq('id', id)
                .eq('receiver_id', cleanerId);

            if (error) throw error;
            return ApiResponse.success(res, null, 'Message marked as read');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to mark message read');
        }
    }
};

module.exports = cleaningController;
