const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');
const { validateRequired, validatePhone } = require('../utils/validators');

const tenantController = {
    // Register tenant
    async create(req, res) {
        try {
            const { full_name, phone, email, id_number, unit_id, lease_start_date, lease_end_date, deposit_paid, water_deposit, electricity_deposit } = req.body;
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

            // Generate a unique username
            let autoUsername = full_name.toLowerCase().replace(/\s+/g, '') + '_' + phone.slice(-4);

            const { data: user, error: userError } = await supabase
                .from('users')
                .insert([{
                    full_name,
                    phone,
                    email: email || null,
                    password_hash,
                    role: 'tenant',
                    username: autoUsername
                }])
                .select('id')
                .single();

            if (userError) {
                // Could be duplicate phone or username – retry with random suffix
                if (userError.code === '23505') {
                    const randomSuffix = Math.random().toString(36).substring(2, 6);
                    autoUsername = autoUsername + '_' + randomSuffix;
                    const { data: user2, error: retryError } = await supabase
                        .from('users')
                        .insert([{
                            full_name,
                            phone,
                            email: email || null,
                            password_hash,
                            role: 'tenant',
                            username: autoUsername
                        }])
                        .select('id')
                        .single();
                    if (retryError) {
                        console.error('Tenant user creation retry failed:', retryError);
                        return ApiResponse.error(res, 'Failed to create tenant user account');
                    }
                    user = user2;
                } else {
                    console.error('Tenant user creation error:', userError);
                    return ApiResponse.error(res, 'Failed to create tenant user account');
                }
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
                    water_deposit: water_deposit || 0,
                    electricity_deposit: electricity_deposit || 0,
                    created_by: req.user.id
                }])
                .select('*')
                .single();

            if (error) {
                // Rollback user creation
                await supabase.from('users').delete().eq('id', user.id);
                console.error('Tenant record creation error:', error);
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
                default_password: defaultPassword,
                username: autoUsername
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

    // Get single tenant – now includes username from linked user
    async getById(req, res) {
        try {
            const { id } = req.params;

            const { data: tenant, error } = await supabase
                .from('tenants')
                .select(`
                    *,
                    units:unit_id(*, apartments:apartment_id(*)),
                    user:user_id(username)
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

            // Allow unit_id, deposits, move-out fields to be updated
            const allowedFields = ['full_name', 'phone', 'email', 'id_number', 'lease_end_date', 'deposit_paid', 'status', 'unit_id', 'water_deposit', 'electricity_deposit', 'move_out_date', 'move_out_reason'];
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            // If status is moved_out and no move_out_date given, set it automatically
            if (req.body.status === 'moved_out' && !req.body.move_out_date) {
                updateData.move_out_date = new Date().toISOString().split('T')[0];
            }

            // If unit_id is being changed, handle unit statuses
            if (req.body.unit_id) {
                // Get current tenant data
                const { data: currentTenant } = await supabase
                    .from('tenants')
                    .select('unit_id, status')
                    .eq('id', id)
                    .single();

                if (currentTenant && currentTenant.unit_id !== req.body.unit_id) {
                    // Old unit becomes vacant
                    await supabase
                        .from('units')
                        .update({ status: 'vacant' })
                        .eq('id', currentTenant.unit_id);

                    // Check if the new unit is available
                    const { data: newUnit } = await supabase
                        .from('units')
                        .select('status')
                        .eq('id', req.body.unit_id)
                        .single();

                    if (!newUnit) {
                        return ApiResponse.badRequest(res, 'New unit not found');
                    }
                    if (newUnit.status !== 'vacant') {
                        // Revert old unit status
                        await supabase
                            .from('units')
                            .update({ status: currentTenant.status === 'active' ? 'occupied' : 'vacant' })
                            .eq('id', currentTenant.unit_id);
                        return ApiResponse.badRequest(res, 'New unit is not vacant');
                    }

                    // New unit becomes occupied
                    await supabase
                        .from('units')
                        .update({ status: 'occupied' })
                        .eq('id', req.body.unit_id);
                }
            }

            const { data: tenant, error } = await supabase
                .from('tenants')
                .update(updateData)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;

            // If tenant moved out, update unit status AND delete user account
            if (req.body.status === 'moved_out') {
                const { data: tenantData } = await supabase
                    .from('tenants')
                    .select('user_id, unit_id')
                    .eq('id', id)
                    .single();

                if (tenantData) {
                    // Free the unit
                    await supabase
                        .from('units')
                        .update({ status: 'vacant' })
                        .eq('id', tenantData.unit_id);

                    // Delete the linked user account
                    if (tenantData.user_id) {
                        await supabase.from('users').delete().eq('id', tenantData.user_id);
                    }
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
