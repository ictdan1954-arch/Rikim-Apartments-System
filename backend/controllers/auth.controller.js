const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { generateToken } = require('../config/jwt');
const ApiResponse = require('../utils/response');
const { validateRequired, validatePhone, validatePassword } = require('../utils/validators');

const authController = {
    // Register new user (Landlord creates caretakers, Caretaker creates tenants)
    async register(req, res) {
        try {
            const { full_name, email, phone, password, role } = req.body;

            // Validate required fields
            const missing = validateRequired(req.body, ['full_name', 'phone', 'password', 'role']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            // Validate role
            if (!['landlord', 'caretaker', 'tenant'].includes(role)) {
                return ApiResponse.badRequest(res, 'Invalid role');
            }

            // Only landlord can create caretaker accounts
            if (role === 'caretaker' && req.user?.role !== 'landlord') {
                return ApiResponse.forbidden(res, 'Only landlord can create caretaker accounts');
            }

            // Validate phone
            if (!validatePhone(phone)) {
                return ApiResponse.badRequest(res, 'Invalid phone number');
            }

            // Validate password
            const passwordError = validatePassword(password);
            if (passwordError) {
                return ApiResponse.badRequest(res, passwordError);
            }

            // Check if user exists
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .or(`phone.eq.${phone}${email ? `,email.eq.${email}` : ''}`)
                .maybeSingle();

            if (existingUser) {
                return ApiResponse.badRequest(res, 'User with this phone or email already exists');
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            // Create user
            const { data: newUser, error } = await supabase
                .from('users')
                .insert([
                    {
                        full_name,
                        email: email || null,
                        phone,
                        password_hash,
                        role
                    }
                ])
                .select('id, full_name, email, phone, role, created_at')
                .single();

            if (error) {
                console.error('Registration error:', error);
                return ApiResponse.error(res, 'Failed to create user');
            }

            // Generate token
            const token = generateToken(newUser);

            return ApiResponse.created(res, {
                user: newUser,
                token
            }, 'User registered successfully');

        } catch (error) {
            console.error('Register error:', error);
            return ApiResponse.error(res, 'Registration failed');
        }
    },

    // Login
    async login(req, res) {
        try {
            const { phone, password } = req.body;

            const missing = validateRequired(req.body, ['phone', 'password']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            // Find user by phone or email
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .or(`phone.eq.${phone},email.eq.${phone}`)
                .eq('is_active', true)
                .maybeSingle();

            if (!user || error) {
                return ApiResponse.unauthorized(res, 'Invalid credentials');
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return ApiResponse.unauthorized(res, 'Invalid credentials');
            }

            // Update last login
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', user.id);

            // Generate token
            const token = generateToken(user);

            // Remove password from response
            const { password_hash, ...userWithoutPassword } = user;

            return ApiResponse.success(res, {
                user: userWithoutPassword,
                token
            }, 'Login successful');

        } catch (error) {
            console.error('Login error:', error);
            return ApiResponse.error(res, 'Login failed');
        }
    },

    // Get current user profile
    async getProfile(req, res) {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('id, full_name, email, phone, role, profile_photo, is_active, last_login, created_at')
                .eq('id', req.user.id)
                .single();

            if (error || !user) {
                return ApiResponse.notFound(res, 'User not found');
            }

            return ApiResponse.success(res, user);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch profile');
        }
    },

    // Get all users (Landlord only)
    async getAllUsers(req, res) {
        try {
            const { role } = req.query;

            let query = supabase
                .from('users')
                .select('id, full_name, email, phone, role, profile_photo, is_active, last_login, created_at');

            if (role) {
                query = query.eq('role', role);
            }

            const { data: users, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            return ApiResponse.success(res, users);
        } catch (error) {
            return ApiResponse.error(res, 'Failed to fetch users');
        }
    },

    // Update user (Landlord only, for managing caretaker/tenant accounts)
    async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const { full_name, password } = req.body;

            // Only landlord can update other users
            if (req.user.role !== 'landlord') {
                return ApiResponse.forbidden(res, 'Only landlord can update user accounts');
            }

            const updateData = {};
            if (full_name) updateData.full_name = full_name;
            if (password) {
                const passwordError = validatePassword(password);
                if (passwordError) {
                    return ApiResponse.badRequest(res, passwordError);
                }
                const salt = await bcrypt.genSalt(10);
                updateData.password_hash = await bcrypt.hash(password, salt);
            }

            if (Object.keys(updateData).length === 0) {
                return ApiResponse.badRequest(res, 'No fields to update');
            }

            const { data: user, error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', userId)
                .select('id, full_name, email, phone, role')
                .single();

            if (error) {
                console.error('Update user error:', error);
                return ApiResponse.error(res, 'Failed to update user');
            }

            return ApiResponse.success(res, user, 'User updated successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update user');
        }
    }
};

module.exports = authController;
