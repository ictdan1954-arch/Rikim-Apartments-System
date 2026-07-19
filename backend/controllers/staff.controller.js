const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');
const { validateRequired } = require('../utils/validators');

const staffController = {
    // =============================================
    // STAFF ROLES (Landlord only)
    // =============================================
    async createRole(req, res) {
        try {
            const { role_name, description } = req.body;
            const missing = validateRequired(req.body, ['role_name']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, 'Role name is required');
            }

            const { data: role, error } = await supabase
                .from('staff_roles')
                .insert([{
                    role_name,
                    description: description || null,
                    created_by: req.user.id
                }])
                .select('*')
                .single();

            if (error) {
                if (error.code === '23505') {
                    return ApiResponse.badRequest(res, 'Role already exists');
                }
                throw error;
            }

            return ApiResponse.created(res, role, 'Staff role created successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to create staff role');
        }
    },

    async getRoles(req, res) {
        try {
            const { data: roles, error } = await supabase
                .from('staff_roles')
                .select('*')
                .eq('is_active', true)
                .order('role_name');

            if (error) throw error;

            return ApiResponse.success(res, roles);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch staff roles');
        }
    },

    async deleteRole(req, res) {
        try {
            const { id } = req.params;

            const { error } = await supabase
                .from('staff_roles')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;

            return ApiResponse.success(res, null, 'Staff role deactivated');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to deactivate staff role');
        }
    },

    // =============================================
    // STAFF MEMBERS
    // =============================================
    async createMember(req, res) {
        try {
            const { apartment_id, staff_role_id, full_name, phone, id_number, date_hired, monthly_salary, notes } = req.body;
            const missing = validateRequired(req.body, ['apartment_id', 'staff_role_id', 'full_name', 'phone', 'monthly_salary']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            const { data: member, error } = await supabase
                .from('staff_members')
                .insert([{
                    apartment_id,
                    staff_role_id,
                    full_name,
                    phone,
                    id_number: id_number || null,
                    date_hired: date_hired || new Date().toISOString().split('T')[0],
                    monthly_salary,
                    notes: notes || null,
                    added_by: req.user.id
                }])
                .select('*, staff_roles:staff_role_id(role_name)')
                .single();

            if (error) throw error;

            return ApiResponse.created(res, member, 'Staff member added successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to add staff member');
        }
    },

    async getMembers(req, res) {
        try {
            const { apartmentId } = req.params;
            const { status, role_id } = req.query;

            let query = supabase
                .from('staff_members')
                .select('*, staff_roles:staff_role_id(id, role_name)')
                .eq('apartment_id', apartmentId);

            if (status) query = query.eq('status', status);
            if (role_id) query = query.eq('staff_role_id', role_id);

            const { data: members, error } = await query.order('full_name');

            if (error) throw error;

            return ApiResponse.success(res, members);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch staff members');
        }
    },

    // NEW: Get members with account status for a specific apartment
    async getMembersWithAccounts(req, res) {
        try {
            const { apartmentId } = req.params;

            // Fetch staff members for the apartment
            const { data: members, error } = await supabase
                .from('staff_members')
                .select('*, staff_roles:staff_role_id(id, role_name)')
                .eq('apartment_id', apartmentId);

            if (error) throw error;

            // For each member, find the corresponding user (if any)
            const phones = members.map(m => m.phone);
            const { data: users, userError } = await supabase
                .from('users')
                .select('id, phone, username, role')
                .in('phone', phones)
                .in('role', ['staff', 'caretaker']);

            if (userError) throw userError;

            // Attach account info to each member
            const result = members.map(member => {
                const user = users.find(u => u.phone === member.phone);
                return {
                    ...member,
                    user: user || null,
                    has_account: !!user
                };
            });

            return ApiResponse.success(res, result);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch members with accounts');
        }
    },

    async getMemberById(req, res) {
        try {
            const { id } = req.params;

            const { data: member, error } = await supabase
                .from('staff_members')
                .select('*, staff_roles:staff_role_id(*), apartments:apartment_id(id, name)')
                .eq('id', id)
                .single();

            if (error || !member) {
                return ApiResponse.notFound(res, 'Staff member not found');
            }

            return ApiResponse.success(res, member);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch staff member');
        }
    },

    async updateMember(req, res) {
        try {
            const { id } = req.params;
            const updateData = {};

            const allowedFields = ['staff_role_id', 'full_name', 'phone', 'id_number', 'date_hired', 'monthly_salary', 'status', 'notes'];
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            const { data: member, error } = await supabase
                .from('staff_members')
                .update(updateData)
                .eq('id', id)
                .select('*, staff_roles:staff_role_id(role_name)')
                .single();

            if (error) throw error;

            return ApiResponse.success(res, member, 'Staff member updated successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update staff member');
        }
    },

    async deleteMember(req, res) {
        try {
            const { id } = req.params;

            // Soft delete by setting status to terminated
            const { error } = await supabase
                .from('staff_members')
                .update({ status: 'terminated' })
                .eq('id', id);

            if (error) throw error;

            return ApiResponse.success(res, null, 'Staff member terminated');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to terminate staff member');
        }
    },

    // =============================================
    // CREATE USER ACCOUNT FOR A STAFF MEMBER
    // =============================================
    async createStaffAccount(req, res) {
        try {
            const { staff_id, username, password } = req.body;
            const missing = validateRequired(req.body, ['staff_id', 'username', 'password']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            // Fetch staff member details
            const { data: staff } = await supabase
                .from('staff_members')
                .select('full_name, phone')
                .eq('id', staff_id)
                .single();

            if (!staff) {
                return ApiResponse.notFound(res, 'Staff member not found');
            }

            // Validate password
            if (password.length < 6) {
                return ApiResponse.badRequest(res, 'Password must be at least 6 characters');
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            // Create user with role 'staff'
            const { data: user, error: userError } = await supabase
                .from('users')
                .insert([{
                    full_name: staff.full_name,
                    phone: staff.phone,
                    password_hash,
                    role: 'staff',
                    username
                }])
                .select('id, full_name, phone, username, role')
                .single();

            if (userError) {
                if (userError.code === '23505') {
                    return ApiResponse.badRequest(res, 'Username or phone already exists. Use a different username.');
                }
                throw userError;
            }

            return ApiResponse.created(res, user, 'Staff account created successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to create staff account');
        }
    },

    // =============================================
    // STAFF SALARIES
    // =============================================
    async recordSalary(req, res) {
        try {
            const { staff_id, apartment_id, amount_paid, payment_date, period_start, period_end, payment_method, notes } = req.body;
            const missing = validateRequired(req.body, ['staff_id', 'apartment_id', 'amount_paid', 'payment_date', 'period_start', 'period_end', 'payment_method']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            const { data: salary, error } = await supabase
                .from('staff_salaries')
                .insert([{
                    staff_id,
                    apartment_id,
                    amount_paid,
                    payment_date,
                    period_start,
                    period_end,
                    payment_method,
                    recorded_by: req.user.id,
                    notes: notes || null
                }])
                .select('*')
                .single();

            if (error) throw error;

            return ApiResponse.created(res, salary, 'Salary payment recorded successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to record salary');
        }
    },

    async getSalaries(req, res) {
        try {
            const { apartmentId } = req.params;
            const { staff_id, start_date, end_date } = req.query;

            let query = supabase
                .from('staff_salaries')
                .select('*, staff_members:staff_id(id, full_name)')
                .eq('apartment_id', apartmentId);

            if (staff_id) query = query.eq('staff_id', staff_id);
            if (start_date) query = query.gte('payment_date', start_date);
            if (end_date) query = query.lte('payment_date', end_date);

            const { data: salaries, error } = await query.order('payment_date', { ascending: false });

            if (error) throw error;

            return ApiResponse.success(res, salaries);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch salaries');
        }
    },

    async deleteSalary(req, res) {
        try {
            const { id } = req.params;

            const { error } = await supabase
                .from('staff_salaries')
                .delete()
                .eq('id', id);

            if (error) throw error;

            return ApiResponse.success(res, null, 'Salary record deleted');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to delete salary record');
        }
    }
};

module.exports = staffController;
