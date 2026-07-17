const supabase = require('../config/supabase');
const ApiResponse = require('../utils/response');
const { validateRequired } = require('../utils/validators');

const expenseController = {
    // Create expense
    async create(req, res) {
        try {
            const { apartment_id, category, description, amount, expense_date, receipt_image, notes } = req.body;
            const missing = validateRequired(req.body, ['apartment_id', 'category', 'description', 'amount', 'expense_date']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            const { data: expense, error } = await supabase
                .from('expenses')
                .insert([{
                    apartment_id,
                    category,
                    description,
                    amount,
                    expense_date,
                    recorded_by: req.user.id,
                    receipt_image: receipt_image || null,
                    notes: notes || null
                }])
                .select('*')
                .single();

            if (error) throw error;

            return ApiResponse.created(res, expense, 'Expense recorded successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to record expense');
        }
    },

    // Get expenses for an apartment
    async getByApartment(req, res) {
        try {
            const { apartmentId } = req.params;
            const { category, start_date, end_date } = req.query;

            let query = supabase
                .from('expenses')
                .select(`
                    *,
                    recorded_by_user:recorded_by(id, full_name)
                `)
                .eq('apartment_id', apartmentId);

            if (category) query = query.eq('category', category);
            if (start_date) query = query.gte('expense_date', start_date);
            if (end_date) query = query.lte('expense_date', end_date);

            const { data: expenses, error } = await query.order('expense_date', { ascending: false });

            if (error) throw error;

            return ApiResponse.success(res, expenses);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch expenses');
        }
    },

    // Get single expense
    async getById(req, res) {
        try {
            const { id } = req.params;

            const { data: expense, error } = await supabase
                .from('expenses')
                .select('*, recorded_by_user:recorded_by(id, full_name)')
                .eq('id', id)
                .single();

            if (error || !expense) {
                return ApiResponse.notFound(res, 'Expense not found');
            }

            return ApiResponse.success(res, expense);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch expense');
        }
    },

    // Update expense
    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = {};

            const allowedFields = ['category', 'description', 'amount', 'expense_date', 'receipt_image', 'notes'];
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            const { data: expense, error } = await supabase
                .from('expenses')
                .update(updateData)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;

            return ApiResponse.success(res, expense, 'Expense updated successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update expense');
        }
    },

    // Delete expense
    async delete(req, res) {
        try {
            const { id } = req.params;

            const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id);

            if (error) throw error;

            return ApiResponse.success(res, null, 'Expense deleted successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to delete expense');
        }
    },

    // Get expense summary
    async getSummary(req, res) {
        try {
            const { apartmentId } = req.params;

            const { data: expenses, error } = await supabase
                .from('expenses')
                .select('category, amount')
                .eq('apartment_id', apartmentId);

            if (error) throw error;

            const summary = {};
            let total = 0;
            expenses?.forEach(exp => {
                const cat = exp.category;
                summary[cat] = (summary[cat] || 0) + parseFloat(exp.amount);
                total += parseFloat(exp.amount);
            });

            return ApiResponse.success(res, { by_category: summary, total });
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch expense summary');
        }
    }
};

module.exports = expenseController;
