const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');

const dashboardController = {
    // Landlord dashboard (enhanced)
    async landlordDashboard(req, res) {
        try {
            const { data: apartments } = await supabase
                .from('apartments')
                .select('id, name, status');

            const apartmentIds = apartments?.map(a => a.id) || [];

            // ---------- overall unit stats ----------
            const { count: totalUnits } = await supabase
                .from('units')
                .select('*', { count: 'exact', head: true })
                .in('apartment_id', apartmentIds);

            const { count: occupiedUnits } = await supabase
                .from('units')
                .select('*', { count: 'exact', head: true })
                .in('apartment_id', apartmentIds)
                .eq('status', 'occupied');

            const { count: vacantUnits } = await supabase
                .from('units')
                .select('*', { count: 'exact', head: true })
                .in('apartment_id', apartmentIds)
                .eq('status', 'vacant');

            const occupancyRate = totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

            // ---------- active tenants count ----------
            const { count: activeTenants } = await supabase
                .from('tenants')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active');

            // ---------- expected monthly rent ----------
            const { data: allUnits } = await supabase
                .from('units')
                .select('monthly_rent')
                .in('apartment_id', apartmentIds)
                .eq('status', 'occupied');

            const expectedMonthlyRent = allUnits?.reduce((sum, u) => sum + parseFloat(u.monthly_rent), 0) || 0;

            const now = new Date();
            const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

            // ---------- rent collected this month ----------
            const { data: thisMonthPayments } = await supabase
                .from('rent_payments')
                .select('amount_paid')
                .in('apartment_id', apartmentIds)
                .gte('payment_date', firstOfMonth);

            const rentCollectedThisMonth = thisMonthPayments?.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0) || 0;

            // ---------- expenses this month ----------
            const { data: thisMonthExpenses } = await supabase
                .from('expenses')
                .select('amount')
                .in('apartment_id', apartmentIds)
                .gte('expense_date', firstOfMonth);

            const expensesThisMonth = thisMonthExpenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;

            // ---------- total arrears (all active tenants) ----------
            const { data: activeTenantsData } = await supabase
                .from('tenants')
                .select('id, lease_start_date, units!inner(monthly_rent)')
                .eq('status', 'active');

            let totalArrears = 0;
            if (activeTenantsData) {
                for (const tenant of activeTenantsData) {
                    const { data: payments } = await supabase
                        .from('rent_payments')
                        .select('amount_paid')
                        .eq('tenant_id', tenant.id);
                    const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0) || 0;
                    const leaseStart = new Date(tenant.lease_start_date);
                    const monthsDiff = (now.getFullYear() - leaseStart.getFullYear()) * 12 +
                        (now.getMonth() - leaseStart.getMonth()) + 1;
                    const expected = monthsDiff * parseFloat(tenant.units?.monthly_rent || 0);
                    if (expected > totalPaid) totalArrears += (expected - totalPaid);
                }
            }

            // ---------- pending maintenance ----------
            const { count: pendingMaintenance } = await supabase
                .from('maintenance_requests')
                .select('*', { count: 'exact', head: true })
                .in('apartment_id', apartmentIds)
                .in('status', ['reported', 'in_progress']);

            // ---------- per‑apartment breakdown ----------
            const apartmentsBreakdown = [];
            for (const apt of apartments) {
                const { count: aptUnits } = await supabase
                    .from('units')
                    .select('*', { count: 'exact', head: true })
                    .eq('apartment_id', apt.id);
                const { count: aptOccupied } = await supabase
                    .from('units')
                    .select('*', { count: 'exact', head: true })
                    .eq('apartment_id', apt.id)
                    .eq('status', 'occupied');
                const { data: aptPayments } = await supabase
                    .from('rent_payments')
                    .select('amount_paid')
                    .eq('apartment_id', apt.id)
                    .gte('payment_date', firstOfMonth);
                const aptRent = aptPayments?.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0) || 0;

                apartmentsBreakdown.push({
                    id: apt.id,
                    name: apt.name,
                    status: apt.status,
                    total_units: aptUnits || 0,
                    occupied_units: aptOccupied || 0,
                    rent_collected_this_month: aptRent
                });
            }

            // ---------- recent activity ----------
            const { data: recentRent } = await supabase
                .from('rent_payments')
                .select('amount_paid, payment_date, tenants(full_name), units(unit_number)')
                .in('apartment_id', apartmentIds)
                .order('payment_date', { ascending: false })
                .limit(5);

            const { data: recentMaintenance } = await supabase
                .from('maintenance_requests')
                .select('title, status, date_reported, units(unit_number)')
                .in('apartment_id', apartmentIds)
                .order('created_at', { ascending: false })
                .limit(5);

            return ApiResponse.success(res, {
                total_apartments: apartments?.length || 0,
                total_units: totalUnits || 0,
                occupied_units: occupiedUnits || 0,
                vacant_units: vacantUnits || 0,
                active_tenants: activeTenants || 0,
                expected_monthly_rent: expectedMonthlyRent,
                rent_collected_this_month: rentCollectedThisMonth,
                expenses_this_month: expensesThisMonth,
                pending_maintenance: pendingMaintenance || 0,
                net_income_this_month: rentCollectedThisMonth - expensesThisMonth,
                occupancy_rate: occupancyRate,
                total_arrears: totalArrears,
                apartments_breakdown: apartmentsBreakdown,
                recent_rent_payments: recentRent || [],
                recent_maintenance: recentMaintenance || []
            });
        } catch (error) {
            console.error('Landlord dashboard error:', error);
            return ApiResponse.error(res, 'Failed to load dashboard');
        }
    },

    // Caretaker dashboard
    async caretakerDashboard(req, res) {
        try {
            const { data: assignments } = await supabase
                .from('caretaker_assignments')
                .select('apartment_id')
                .eq('user_id', req.user.id)
                .eq('is_active', true);

            const apartmentIds = assignments?.map(a => a.apartment_id) || [];

            if (apartmentIds.length === 0) {
                return ApiResponse.success(res, {
                    total_apartments: 0,
                    total_units: 0,
                    occupied_units: 0,
                    vacant_units: 0,
                    active_tenants: 0,
                    expected_monthly_rent: 0,
                    rent_collected_this_month: 0,
                    expenses_this_month: 0,
                    pending_maintenance: 0
                });
            }

            const { count: totalUnits } = await supabase
                .from('units')
                .select('*', { count: 'exact', head: true })
                .in('apartment_id', apartmentIds);

            const { count: occupiedUnits } = await supabase
                .from('units')
                .select('*', { count: 'exact', head: true })
                .in('apartment_id', apartmentIds)
                .eq('status', 'occupied');

            const { count: vacantUnits } = await supabase
                .from('units')
                .select('*', { count: 'exact', head: true })
                .in('apartment_id', apartmentIds)
                .eq('status', 'vacant');

            const { data: unitIds } = await supabase
                .from('units')
                .select('id')
                .in('apartment_id', apartmentIds);

            const ids = unitIds?.map(u => u.id) || [];

            const { count: activeTenants } = await supabase
                .from('tenants')
                .select('*', { count: 'exact', head: true })
                .in('unit_id', ids)
                .eq('status', 'active');

            const { data: occupiedUnitsData } = await supabase
                .from('units')
                .select('monthly_rent')
                .in('apartment_id', apartmentIds)
                .eq('status', 'occupied');

            const expectedMonthlyRent = occupiedUnitsData?.reduce((sum, u) => sum + parseFloat(u.monthly_rent), 0) || 0;

            const now = new Date();
            const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

            const { data: thisMonthPayments } = await supabase
                .from('rent_payments')
                .select('amount_paid')
                .in('apartment_id', apartmentIds)
                .gte('payment_date', firstOfMonth);

            const rentCollectedThisMonth = thisMonthPayments?.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0) || 0;

            const { data: thisMonthExpenses } = await supabase
                .from('expenses')
                .select('amount')
                .in('apartment_id', apartmentIds)
                .gte('expense_date', firstOfMonth);

            const expensesThisMonth = thisMonthExpenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;

            const { count: pendingMaintenance } = await supabase
                .from('maintenance_requests')
                .select('*', { count: 'exact', head: true })
                .in('apartment_id', apartmentIds)
                .in('status', ['reported', 'in_progress']);

            return ApiResponse.success(res, {
                total_apartments: apartmentIds.length,
                total_units: totalUnits || 0,
                occupied_units: occupiedUnits || 0,
                vacant_units: vacantUnits || 0,
                active_tenants: activeTenants || 0,
                expected_monthly_rent: expectedMonthlyRent,
                rent_collected_this_month: rentCollectedThisMonth,
                expenses_this_month: expensesThisMonth,
                pending_maintenance: pendingMaintenance || 0,
                net_income_this_month: rentCollectedThisMonth - expensesThisMonth
            });
        } catch (error) {
            return ApiResponse.error(res, 'Failed to load dashboard');
        }
    },

    // Tenant dashboard (enhanced with deposits, apartment name, announcements, next due date)
    async tenantDashboard(req, res) {
        try {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('*, units:unit_id(id, unit_number, monthly_rent, apartment_id, apartments:apartment_id(id, name))')
                .eq('user_id', req.user.id)
                .eq('status', 'active')
                .single();

            if (!tenant) {
                return ApiResponse.success(res, { message: 'No active tenancy found' });
            }

            // Payment history
            const { data: payments } = await supabase
                .from('rent_payments')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('payment_date', { ascending: false });

            const totalPaid = payments?.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0) || 0;

            // Calculate arrears
            const leaseStart = new Date(tenant.lease_start_date);
            const now = new Date();
            const monthsDiff = (now.getFullYear() - leaseStart.getFullYear()) * 12 +
                (now.getMonth() - leaseStart.getMonth()) + 1;
            const expectedRent = monthsDiff * parseFloat(tenant.units?.monthly_rent || 0);
            const arrears = Math.max(0, expectedRent - totalPaid);

            // Next due date (5th of next month)
            const nextDue = new Date(now.getFullYear(), now.getMonth() + 1, 5);
            const nextDueFormatted = nextDue.toISOString().split('T')[0];

            // Maintenance requests
            const { data: maintenanceRequests } = await supabase
                .from('maintenance_requests')
                .select('*')
                .eq('reported_by', req.user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            // Announcements for the tenant's apartment
            const { data: announcements } = await supabase
                .from('announcements')
                .select('*')
                .eq('apartment_id', tenant.units?.apartment_id)
                .order('created_at', { ascending: false })
                .limit(5);

            return ApiResponse.success(res, {
                tenant: {
                    id: tenant.id,
                    full_name: tenant.full_name,
                    unit_number: tenant.units?.unit_number,
                    monthly_rent: tenant.units?.monthly_rent,
                    unit_id: tenant.unit_id,
                    apartment_id: tenant.units?.apartment_id,
                    apartment_name: tenant.units?.apartments?.name,
                    lease_start_date: tenant.lease_start_date,
                    lease_end_date: tenant.lease_end_date,
                    deposit_paid: tenant.deposit_paid || 0,
                    water_deposit: tenant.water_deposit || 0,
                    electricity_deposit: tenant.electricity_deposit || 0,
                    next_due_date: nextDueFormatted
                },
                payment_summary: {
                    total_paid: totalPaid,
                    expected_rent: expectedRent,
                    arrears: arrears,
                    recent_payments: payments?.slice(0, 5) || []
                },
                maintenance_requests: maintenanceRequests || [],
                announcements: announcements || []
            });
        } catch (error) {
            return ApiResponse.error(res, 'Failed to load dashboard');
        }
    },

    // Staff dashboard
    async staffDashboard(req, res) {
        try {
            const { data: user } = await supabase
                .from('users')
                .select('phone')
                .eq('id', req.user.id)
                .single();

            if (!user) return ApiResponse.notFound(res, 'User not found');

            const { data: staff } = await supabase
                .from('staff_members')
                .select('*, staff_roles:staff_role_id(role_name), apartments:apartment_id(id, name)')
                .eq('phone', user.phone)
                .eq('status', 'active')
                .single();

            if (!staff) {
                return ApiResponse.success(res, { message: 'No active staff profile found' });
            }

            // Recent salary payments (last 5)
            const { data: salaries } = await supabase
                .from('staff_salaries')
                .select('*')
                .eq('staff_id', staff.id)
                .order('payment_date', { ascending: false })
                .limit(5);

            // Assigned maintenance tasks
            const { data: tasks } = await supabase
                .from('maintenance_requests')
                .select('*, units:unit_id(unit_number)')
                .eq('assigned_staff_id', staff.id)
                .neq('status', 'resolved')
                .order('created_at', { ascending: false });

            // Announcements for the staff's apartment
            const { data: announcements } = await supabase
                .from('announcements')
                .select('*')
                .eq('apartment_id', staff.apartment_id)
                .order('created_at', { ascending: false })
                .limit(10);

            return ApiResponse.success(res, {
                staff,
                salaries: salaries || [],
                tasks: tasks || [],
                announcements: announcements || []
            });
        } catch (error) {
            return ApiResponse.error(res, 'Failed to load staff dashboard');
        }
    }
};

module.exports = dashboardController;
