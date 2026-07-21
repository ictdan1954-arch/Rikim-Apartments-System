const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');
const { validateRequired } = require('../utils/validators');

const apartmentController = {
    // Create apartment (Landlord only)
    async create(req, res) {
        try {
            const { name, location, description } = req.body;
            const missing = validateRequired(req.body, ['name', 'location']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            const { data: apartment, error } = await supabase
                .from('apartments')
                .insert([{
                    name,
                    location,
                    description: description || null,
                    created_by: req.user.id
                }])
                .select('*')
                .single();

            if (error) {
                console.error('Create apartment error:', error);
                return ApiResponse.error(res, 'Failed to create apartment');
            }

            return ApiResponse.created(res, apartment, 'Apartment created successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to create apartment');
        }
    },

    // Get all apartments (with unit stats)
    async getAll(req, res) {
        try {
            let query = supabase.from('apartments').select('*');

            // Caretaker sees only assigned apartments
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
                query = query.in('id', apartmentIds);
            }

            const { data: apartments, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            // If there are apartments, fetch their unit stats
            if (apartments && apartments.length > 0) {
                const allApartmentIds = apartments.map(a => a.id);
                const { data: units } = await supabase
                    .from('units')
                    .select('apartment_id, status')
                    .in('apartment_id', allApartmentIds);

                // Build counts per apartment
                const counts = {};
                (units || []).forEach(u => {
                    if (!counts[u.apartment_id]) {
                        counts[u.apartment_id] = { total: 0, occupied: 0 };
                    }
                    counts[u.apartment_id].total++;
                    if (u.status === 'occupied') {
                        counts[u.apartment_id].occupied++;
                    }
                });

                // Attach counts to each apartment
                const enriched = apartments.map(a => ({
                    ...a,
                    unit_count: counts[a.id]?.total || 0,
                    occupied_count: counts[a.id]?.occupied || 0
                }));

                return ApiResponse.success(res, enriched);
            }

            return ApiResponse.success(res, apartments);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch apartments');
        }
    },

    // Get single apartment – now includes unit‑type breakdown
    async getById(req, res) {
        try {
            const { id } = req.params;

            const { data: apartment, error } = await supabase
                .from('apartments')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !apartment) {
                return ApiResponse.notFound(res, 'Apartment not found');
            }

            // Fetch all units for this apartment
            const { data: units, error: unitsError } = await supabase
                .from('units')
                .select('unit_type, status')
                .eq('apartment_id', id);

            if (unitsError) throw unitsError;

            // Total unit count
            const unitCount = units.length;
            // Occupied count
            const occupiedCount = units.filter(u => u.status === 'occupied').length;

            // Build breakdown by unit_type
            const breakdownMap = {};
            units.forEach(u => {
                const type = u.unit_type;
                if (!breakdownMap[type]) {
                    breakdownMap[type] = { total: 0, occupied: 0 };
                }
                breakdownMap[type].total++;
                if (u.status === 'occupied') breakdownMap[type].occupied++;
            });

            const unitsBreakdown = Object.keys(breakdownMap).map(type => ({
                unit_type: type,
                total: breakdownMap[type].total,
                occupied: breakdownMap[type].occupied,
                vacant: breakdownMap[type].total - breakdownMap[type].occupied
            }));

            // Active tenants count
            const { count: tenantCount } = await supabase
                .from('tenants')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'active')
                .in('unit_id', units.map(u => u.id));

            return ApiResponse.success(res, {
                ...apartment,
                unit_count: unitCount || 0,
                tenant_count: tenantCount || 0,
                units_breakdown: unitsBreakdown
            });
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch apartment');
        }
    },

    // Update apartment
    async update(req, res) {
        try {
            const { id } = req.params;
            const { name, location, description, status } = req.body;

            const { data: apartment, error } = await supabase
                .from('apartments')
                .update({
                    name: name || undefined,
                    location: location || undefined,
                    description: description !== undefined ? description : undefined,
                    status: status || undefined
                })
                .eq('id', id)
                .select('*')
                .single();

            if (error) {
                return ApiResponse.error(res, 'Failed to update apartment');
            }

            return ApiResponse.success(res, apartment, 'Apartment updated successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update apartment');
        }
    },

    // Delete apartment
    async delete(req, res) {
        try {
            const { id } = req.params;

            const { error } = await supabase
                .from('apartments')
                .delete()
                .eq('id', id);

            if (error) {
                return ApiResponse.error(res, 'Failed to delete apartment');
            }

            return ApiResponse.success(res, null, 'Apartment deleted successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to delete apartment');
        }
    },

    // Assign caretaker to apartment
    async assignCaretaker(req, res) {
        try {
            const { apartmentId } = req.params;
            const { user_id } = req.body;

            const missing = validateRequired(req.body, ['user_id']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, 'Missing user_id');
            }

            // Verify caretaker exists
            const { data: caretaker } = await supabase
                .from('users')
                .select('id, role')
                .eq('id', user_id)
                .eq('role', 'caretaker')
                .single();

            if (!caretaker) {
                return ApiResponse.badRequest(res, 'Invalid caretaker');
            }

            // Check if already assigned
            const { data: existing } = await supabase
                .from('caretaker_assignments')
                .select('id')
                .eq('user_id', user_id)
                .eq('apartment_id', apartmentId)
                .maybeSingle();

            if (existing) {
                return ApiResponse.badRequest(res, 'Caretaker already assigned to this apartment');
            }

            const { data: assignment, error } = await supabase
                .from('caretaker_assignments')
                .insert([{
                    user_id,
                    apartment_id: apartmentId
                }])
                .select('*')
                .single();

            if (error) throw error;

            return ApiResponse.created(res, assignment, 'Caretaker assigned successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to assign caretaker');
        }
    },

    // Get apartment caretakers – now includes username
    async getCaretakers(req, res) {
        try {
            const { apartmentId } = req.params;

            const { data, error } = await supabase
                .from('caretaker_assignments')
                .select('*, users(id, full_name, phone, email, username)')
                .eq('apartment_id', apartmentId)
                .eq('is_active', true);

            if (error) throw error;

            return ApiResponse.success(res, data);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch caretakers');
        }
    },

    // Remove caretaker assignment
    async removeCaretaker(req, res) {
        try {
            const { assignmentId } = req.params;

            const { error } = await supabase
                .from('caretaker_assignments')
                .update({ is_active: false })
                .eq('id', assignmentId);

            if (error) throw error;

            return ApiResponse.success(res, null, 'Caretaker removed successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to remove caretaker');
        }
    }
};

module.exports = apartmentController;
