const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');
const { validateRequired } = require('../utils/validators');

const rentController = {
    // Record rent payment
    async create(req, res) {
        try {
            const { 
                tenant_id, unit_id, apartment_id, amount_paid, payment_date, 
                period_start, period_end, payment_method, reference_number, 
                notes, purpose 
            } = req.body;

            const missing = validateRequired(req.body, [
                'tenant_id', 'unit_id', 'apartment_id', 'amount_paid', 
                'payment_date', 'period_start', 'period_end', 'payment_method'
            ]);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            const { data: payment, error } = await supabase
                .from('rent_payments')
                .insert([{
                    tenant_id,
                    unit_id,
                    apartment_id,
                    amount_paid,
                    payment_date,
                    period_start,
                    period_end,
                    payment_method,
                    reference_number: reference_number || null,
                    recorded_by: req.user.id,
                    notes: notes || null,
                    purpose: purpose || 'monthly_rent'
                }])
                .select('*')
                .single();

            if (error) throw error;

            await supabase.from('notifications').insert([{
                user_id: req.user.id,
                title: 'Rent Payment Recorded',
                message: `Payment of ${amount_paid} recorded for tenant`,
                type: 'rent_reminder'
            }]);

            return ApiResponse.created(res, payment, 'Rent payment recorded successfully');
        } catch (error) {
            console.error('Create payment error:', error);
            return ApiResponse.error(res, 'Failed to record payment');
        }
    },

    // Get payments for an apartment (or all for landlord)
    async getByApartment(req, res) {
        try {
            const { apartmentId } = req.params;
            const { start_date, end_date, tenant_id } = req.query;

            let query = supabase
                .from('rent_payments')
                .select(`
                    *,
                    tenants:tenant_id(id, full_name, phone),
                    units:unit_id(id, unit_number)
                `);

            if (apartmentId !== 'all') {
                query = query.eq('apartment_id', apartmentId);
            } else {
                if (req.user.role === 'caretaker') {
                    const { data: assignments } = await supabase
                        .from('caretaker_assignments')
                        .select('apartment_id')
                        .eq('user_id', req.user.id)
                        .eq('is_active', true);
                    const apartmentIds = assignments?.map(a => a.apartment_id) || [];
                    if (apartmentIds.length === 0) {
                        return ApiResponse.success(res, []);
                    }
                    query = query.in('apartment_id', apartmentIds);
                }
            }

            if (start_date) query = query.gte('payment_date', start_date);
            if (end_date) query = query.lte('payment_date', end_date);
            if (tenant_id) query = query.eq('tenant_id', tenant_id);

            const { data: payments, error } = await query.order('payment_date', { ascending: false });

            if (error) throw error;

            return ApiResponse.success(res, payments);
        } catch (error) {
            console.error('Fetch payments error:', error);
            return ApiResponse.error(res, 'Failed to fetch payments');
        }
    },

    // Get payment by ID
    async getById(req, res) {
        try {
            const { id } = req.params;

            const { data: payment, error } = await supabase
                .from('rent_payments')
                .select(`
                    *,
                    tenants:tenant_id(id, full_name, phone),
                    units:unit_id(id, unit_number)
                `)
                .eq('id', id)
                .single();

            if (error || !payment) {
                return ApiResponse.notFound(res, 'Payment not found');
            }

            return ApiResponse.success(res, payment);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch payment');
        }
    },

    // Get tenant arrears
    async getArrears(req, res) {
        try {
            const { tenantId } = req.params;

            const { data: tenant } = await supabase
                .from('tenants')
                .select('*, units:unit_id(monthly_rent)')
                .eq('id', tenantId)
                .single();

            if (!tenant) {
                return ApiResponse.notFound(res, 'Tenant not found');
            }

            const { data: payments } = await supabase
                .from('rent_payments')
                .select('amount_paid, period_start, period_end')
                .eq('tenant_id', tenantId);

            const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0) || 0;

            const leaseStart = new Date(tenant.lease_start_date);
            const now = new Date();
            const monthsDiff = (now.getFullYear() - leaseStart.getFullYear()) * 12 +
                (now.getMonth() - leaseStart.getMonth()) + 1;

            const expectedRent = monthsDiff * parseFloat(tenant.units?.monthly_rent || 0);
            const arrears = expectedRent - totalPaid;

            return ApiResponse.success(res, {
                tenant_id: tenantId,
                monthly_rent: tenant.units?.monthly_rent || 0,
                months_occupied: monthsDiff,
                expected_total: expectedRent,
                total_paid: totalPaid,
                arrears: arrears > 0 ? arrears : 0,
                is_overdue: arrears > 0
            });
        } catch (error) {
            return ApiResponse.error(res, 'Failed to calculate arrears');
        }
    },

    // Get payment status summary for an apartment (or all)
    async getPaymentStatus(req, res) {
        try {
            const { apartmentId } = req.params;
            const now = new Date();
            const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

            let query = supabase
                .from('tenants')
                .select(`
                    id, full_name, phone, lease_start_date,
                    units:unit_id(id, unit_number, monthly_rent, apartment_id,
                        apartments:apartment_id(id, name))
                `)
                .eq('status', 'active');

            if (apartmentId !== 'all') {
                const { data: unitIds } = await supabase
                    .from('units')
                    .select('id')
                    .eq('apartment_id', apartmentId);
                const ids = unitIds?.map(u => u.id) || [];
                if (ids.length === 0) {
                    return ApiResponse.success(res, { total_tenants: 0, paid_tenants: 0, unpaid_tenants: 0, unpaid_list: [] });
                }
                query = query.in('unit_id', ids);
            } else if (req.user.role === 'caretaker') {
                const { data: assignments } = await supabase
                    .from('caretaker_assignments')
                    .select('apartment_id')
                    .eq('user_id', req.user.id)
                    .eq('is_active', true);
                const aptIds = assignments?.map(a => a.apartment_id) || [];
                if (aptIds.length === 0) {
                    return ApiResponse.success(res, { total_tenants: 0, paid_tenants: 0, unpaid_tenants: 0, unpaid_list: [] });
                }
                const { data: unitIds } = await supabase
                    .from('units')
                    .select('id')
                    .in('apartment_id', aptIds);
                const ids = unitIds?.map(u => u.id) || [];
                query = query.in('unit_id', ids);
            }

            const { data: tenants } = await query;

            if (!tenants || tenants.length === 0) {
                return ApiResponse.success(res, { total_tenants: 0, paid_tenants: 0, unpaid_tenants: 0, unpaid_list: [] });
            }

            const paidList = [];
            const unpaidList = [];

            for (const tenant of tenants) {
                const { data: payments } = await supabase
                    .from('rent_payments')
                    .select('amount_paid')
                    .eq('tenant_id', tenant.id)
                    .gte('payment_date', firstOfMonth);

                const hasPaid = payments && payments.length > 0;

                // Calculate arrears
                const { data: allPayments } = await supabase
                    .from('rent_payments')
                    .select('amount_paid')
                    .eq('tenant_id', tenant.id);
                const totalPaid = allPayments?.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0) || 0;
                const leaseStart = new Date(tenant.lease_start_date || now);
                const monthsDiff = (now.getFullYear() - leaseStart.getFullYear()) * 12 +
                    (now.getMonth() - leaseStart.getMonth()) + 1;
                const expectedRent = monthsDiff * parseFloat(tenant.units?.monthly_rent || 0);
                const arrears = Math.max(0, expectedRent - totalPaid);

                const tenantInfo = {
                    id: tenant.id,
                    full_name: tenant.full_name,
                    phone: tenant.phone,
                    unit_number: tenant.units?.unit_number,
                    unit_id: tenant.units?.id,
                    apartment_name: tenant.units?.apartments?.name,
                    apartment_id: tenant.units?.apartment_id,
                    monthly_rent: tenant.units?.monthly_rent,
                    arrears: arrears
                };

                if (hasPaid) {
                    paidList.push(tenantInfo);
                } else {
                    unpaidList.push(tenantInfo);
                }
            }

            return ApiResponse.success(res, {
                total_tenants: tenants.length,
                paid_tenants: paidList.length,
                unpaid_tenants: unpaidList.length,
                unpaid_list: unpaidList,
                paid_list: paidList
            });
        } catch (error) {
            console.error('Payment status error:', error);
            return ApiResponse.error(res, 'Failed to fetch payment status');
        }
    },

    // Update payment
    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = {};

            const allowedFields = [
                'amount_paid', 'payment_date', 'period_start', 'period_end', 
                'payment_method', 'reference_number', 'notes', 'purpose'
            ];
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            const { data: payment, error } = await supabase
                .from('rent_payments')
                .update(updateData)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;

            return ApiResponse.success(res, payment, 'Payment updated successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update payment');
        }
    },

    // Delete payment
    async delete(req, res) {
        try {
            const { id } = req.params;

            const { error } = await supabase
                .from('rent_payments')
                .delete()
                .eq('id', id);

            if (error) throw error;

            return ApiResponse.success(res, null, 'Payment deleted successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to delete payment');
        }
    }
};

module.exports = rentController;
