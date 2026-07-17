const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');
const { validateRequired, validatePhone } = require('../utils/validators');

const tenantController = {
    // Register tenant
    async create(req, res) {
        try {
            const { full_name, phone, email, id_number, unit_id, lease_start_date, lease_end_date, deposit_paid } = req.body;
            const missing = validateRequired(req.body, ['full_name', 'phone', 'unit_id']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            // Check if unit is available
            const { data: unit } = await supabase
                .from('units')
                .select('id, apartment_id, status')
                .eq('id', unit_id)
                .single();

            if (!unit) {
                return ApiResponse.badRequest(res, 'Unit not found');
            }
            if (unit.status !== 'vacant') {
                return ApiResponse.badRequest(res, 'Unit is not available');
            }

            // Create user account for tenant
            const defaultPassword = phone.replace(/\D/g, '').slice(-6) || '123456';
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(defaultPassword, salt);

            const { data: user, error: userError } = await supabase
                .from('users')
                .insert([{
                    full_name,
                    phone,
                    email: email || null,
                    password_hash,
                    role: 'tenant'
                }])
                .select('id')
                .single();

            if (userError) {
                return ApiResponse.error(res, 'Failed to create tenant user account');
            }

            // Create tenant record
            const { data: tenant, error } = await supabase
                .from('tenants')
                .insert([{
                    user_id: user.id,
                    full_name,
                    phone,
                    email: email || null,
                    id_number: id_number || null,
                    unit_id,
                    lease_start_date: lease_start_date || new Date().toISOString().split('T')[0],
                    lease_end_date: lease_end_date || null,
                    deposit_paid: deposit_paid || 0,
                    created_by: req.user.id
                }])
                .select('*')
                .single();

            if (error) {
                // Rollback user creation
                await supabase.from('users').delete().eq('id', user.id);
                return ApiResponse.error(res, 'Failed to create tenant');
            }

            // Update unit status
            await supabase
                .from('units')
                .update({ status: 'occupied' })
                .eq('id', unit_id);

            // Create notification
            await supabase.from('notifications').insert([{
                user_id: req.user.id,
                title: 'New Tenant Registered',
                message: `${full_name} has been registered to unit ${unit_id}`,
                type: 'new_tenant'
            }]);

            return ApiResponse.created(res, {
                tenant,
                default_password: defaultPassword
            }, 'Tenant registered successfully');

        } catch (error) {
            console.error('Create tenant error:', error);
            return ApiResponse.error(res, 'Failed to register tenant');
        }
    },

    // Get all tenants
    async getAll(req, res) {
        try {
            const { status, apartment_id, search } = req.query;

            let query = supabase
                .from('tenants')
                .select(`
                    *,
                    units:unit_id(id, unit_number, unit_type, monthly_rent, apartment_id,
                        apartments:apartment_id(id, name)
                    )
                `);

            if (status) query = query.eq('status', status);
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
            }
            if (apartment_id) {
                // Filter by apartment through unit relationship
                const { data: unitIds } = await supabase
                    .from('units')
                    .select('id')
                    .eq('apartment_id', apartment_id);
                const ids = unitIds?.map(u => u.id) || [];
                if (ids.length > 0) {
                    query = query.in('unit_id', ids);
                }
            }

            const { data: tenants, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            return ApiResponse.success(res, tenants);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch tenants');
        }
    },

    // Get single tenant
    async getById(req, res) {
        try {
            const { id } = req.params;

            const { data: tenant, error } = await supabase
                .from('tenants')
                .select(`
                    *,
                    units:unit_id(*, apartments:apartment_id(*))
                `)
                .eq('id', id)
                .single();

            if (error || !tenant) {
                return ApiResponse.notFound(res, 'Tenant not found');
            }

            // Get payment summary
            const { data: payments } = await supabase
                .from('rent_payments')
                .select('amount_paid')
                .eq('tenant_id', id);

            const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0) || 0;

            return ApiResponse.success(res, {
                ...tenant,
                total_paid: totalPaid
            });
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch tenant');
        }
    },

    // Update tenant
    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = {};

            const allowedFields = ['full_name', 'phone', 'email', 'id_number', 'lease_end_date', 'deposit_paid', 'status'];
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            const { data: tenant, error } = await supabase
                .from('tenants')
                .update(updateData)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;

            // If tenant moved out, update unit status
            if (req.body.status === 'moved_out') {
                const { data: tenantData } = await supabase
                    .from('tenants')
                    .select('unit_id')
                    .eq('id', id)
                    .single();

                if (tenantData) {
                    await supabase
                        .from('units')
                        .update({ status: 'vacant' })
                        .eq('id', tenantData.unit_id);
                }
            }

            return ApiResponse.success(res, tenant, 'Tenant updated successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update tenant');
        }
    },

    // Delete tenant
    async delete(req, res) {
        try {
            const { id } = req.params;

            // Get tenant data first
            const { data: tenant } = await supabase
                .from('tenants')
                .select('user_id, unit_id')
                .eq('id', id)
                .single();

            const { error } = await supabase
                .from('tenants')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Also delete user account
            if (tenant?.user_id) {
                await supabase.from('users').delete().eq('id', tenant.user_id);
            }

            return ApiResponse.success(res, null, 'Tenant deleted successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to delete tenant');
        }
    },

    // Get tenant's payment history
    async getPayments(req, res) {
        try {
            const { id } = req.params;

            const { data: payments, error } = await supabase
                .from('rent_payments')
                .select('*')
                .eq('tenant_id', id)
                .order('payment_date', { ascending: false });

            if (error) throw error;

            return ApiResponse.success(res, payments);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch payments');
        }
    }
};

module.exports = tenantController;
