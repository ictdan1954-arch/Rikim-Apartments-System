const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');

// Caretakers can only access their assigned apartments
const checkApartmentAccess = async (req, res, next) => {
    try {
        // Landlord has access to everything
        if (req.user.role === 'landlord') {
            return next();
        }

        // Tenant can only access their own unit's apartment
        if (req.user.role === 'tenant') {
            const { data: tenant } = await supabase
                .from('tenants')
                .select('unit_id, units(apartment_id)')
                .eq('user_id', req.user.id)
                .single();

            if (tenant) {
                req.apartment_id = tenant.units?.apartment_id;
                return next();
            }
            return ApiResponse.forbidden(res, 'No apartment access');
        }

        // Caretaker - check apartment assignment
        const apartmentId = req.params.apartmentId || req.body.apartment_id;

        if (!apartmentId) {
            return next(); // Let the controller handle missing apartment ID
        }

        const { data: assignment, error } = await supabase
            .from('caretaker_assignments')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('apartment_id', apartmentId)
            .eq('is_active', true)
            .single();

        if (!assignment || error) {
            return ApiResponse.forbidden(res, 'You do not have access to this apartment');
        }

        req.apartment_id = apartmentId;
        next();
    } catch (error) {
        return ApiResponse.error(res, 'Error checking apartment access');
    }
};

module.exports = checkApartmentAccess;
