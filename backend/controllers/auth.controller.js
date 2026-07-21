const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { generateToken } = require('../config/jwt');
const ApiResponse = require('../utils/response');
const { validateRequired, validatePhone, validatePassword } = require('../utils/validators');

const authController = {
    // Register new user (Landlord creates caretakers/staff, Caretaker creates tenants)
    async register(req, res) {
        try {
            const { full_name, email, phone, password, role, username } = req.body;

            // Validate required fields
            const missing = validateRequired(req.body, ['full_name', 'phone', 'password', 'role']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            // Validate role - now includes 'staff'
            if (!['landlord', 'caretaker', 'tenant', 'staff'].includes(role)) {
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

            // Validate username if provided
            if (username) {
                const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
                if (!usernameRegex.test(username)) {
                    return ApiResponse.badRequest(res, 'Username must be 3-30 characters and contain only letters, numbers, and underscores');
                }
            }

            // Check if user exists (by phone, email, or username)
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .or(`phone.eq.${phone}${email ? `,email.eq.${email}` : ''}${username ? `,username.eq.${username}` : ''}`)
                .maybeSingle();

            if (existingUser) {
                return ApiResponse.badRequest(res, 'User with this phone, email, or username already exists');
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
                        role,
                        username: username || null
                    }
                ])
                .select('id, full_name, email, phone, role, username, created_at')
                .single();

            if (error) {
                console.error('Registration error:', error);
                return ApiResponse.error(res, 'Failed to create user');
            }

            // Generate token (optional, usually not needed for admin-created accounts)
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

    // Login – accepts username, email, or phone
    async login(req, res) {
        try {
            const { phone, password } = req.body; // "phone" field is used for any identifier
            const identifier = phone?.trim();

            const missing = validateRequired(req.body, ['phone', 'password']);
            if (missing.length > 0) {
                return ApiResponse.badRequest(res, `Missing fields: ${missing.join(', ')}`);
            }

            // Sanitize identifier to prevent filter injection
            const safeIdentifier = identifier.replace(/'/g, "''");

            // Find user by username, email, or phone
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .or(`phone.eq.${safeIdentifier},email.eq.${safeIdentifier},username.eq.${safeIdentifier}`)
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
                .select('id, full_name, email, phone, username, role, profile_photo, is_active, last_login, created_at')
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
                .select('id, full_name, email, phone, username, role, profile_photo, is_active, last_login, created_at');

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

    // Update user (Landlord full access, Caretaker only staff/tenants in their apartment)
    async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const { full_name, password, username } = req.body;

            // Get the target user
            const { data: targetUser, error: fetchError } = await supabase
                .from('users')
                .select('id, phone, role')
                .eq('id', userId)
                .single();

            if (fetchError || !targetUser) {
                return ApiResponse.notFound(res, 'User not found');
            }

            // Caretaker restrictions
            if (req.user.role === 'caretaker') {
                // 1. Cannot edit themselves
                if (targetUser.id === req.user.id) {
                    return ApiResponse.forbidden(res, 'You cannot edit your own account');
                }

                // 2. If the target is a tenant, check that they live in one of the caretaker's apartments
                if (targetUser.role === 'tenant') {
                    // Find the tenant's apartment through their unit
                    const { data: tenantData } = await supabase
                        .from('tenants')
                        .select('unit_id, units!inner(apartment_id)')
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (!tenantData) {
                        return ApiResponse.forbidden(res, 'Tenant record not found');
                    }

                    const apartmentId = tenantData.units?.apartment_id;
                    if (!apartmentId) {
                        return ApiResponse.forbidden(res, 'Tenant does not have an apartment');
                    }

                    // Check if the caretaker is assigned to that apartment
                    const { data: assignment } = await supabase
                        .from('caretaker_assignments')
                        .select('id')
                        .eq('user_id', req.user.id)
                        .eq('apartment_id', apartmentId)
                        .eq('is_active', true)
                        .maybeSingle();

                    if (!assignment) {
                        return ApiResponse.forbidden(res, 'You can only edit tenants from your assigned apartment');
                    }
                }

                // 3. If the target is a staff member (not tenant), verify they work in the caretaker's apartment
                if (targetUser.role !== 'tenant') {
                    const { data: staff } = await supabase
                        .from('staff_members')
                        .select('apartment_id')
                        .eq('phone', targetUser.phone)
                        .maybeSingle();

                    if (!staff) {
                        return ApiResponse.forbidden(res, 'You can only edit users linked to your apartment staff');
                    }

                    const { data: assignment } = await supabase
                        .from('caretaker_assignments')
                        .select('id')
                        .eq('user_id', req.user.id)
                        .eq('apartment_id', staff.apartment_id)
                        .eq('is_active', true)
                        .maybeSingle();

                    if (!assignment) {
                        return ApiResponse.forbidden(res, 'You can only edit staff from your assigned apartment');
                    }
                }
            }

            // Landlord has no restrictions

            const updateData = {};
            if (full_name) updateData.full_name = full_name;
            if (username) {
                const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
                if (!usernameRegex.test(username)) {
                    return ApiResponse.badRequest(res, 'Username must be 3-30 characters and contain only letters, numbers, and underscores');
                }
                // Check uniqueness
                const { data: existing } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .neq('id', userId)
                    .maybeSingle();
                if (existing) {
                    return ApiResponse.badRequest(res, 'Username already taken');
                }
                updateData.username = username;
            }
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
                .select('id, full_name, email, phone, username, role')
                .single();

            if (error) {
                console.error('Update user error:', error);
                return ApiResponse.error(res, 'Failed to update user');
            }

            return ApiResponse.success(res, user, 'User updated successfully');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update user');
        }
    },

    // ====================================================
    // Update own profile (any authenticated user)
    // ====================================================
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const { username, password, profile_photo } = req.body;
            const updateData = {};

            if (username) {
                const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
                if (!usernameRegex.test(username)) {
                    return ApiResponse.badRequest(res, 'Username must be 3-30 characters and contain only letters, numbers, underscores');
                }
                // Check uniqueness
                const { data: existing } = await supabase
                    .from('users')
                    .select('id')
                    .eq('username', username)
                    .neq('id', userId)
                    .maybeSingle();
                if (existing) {
                    return ApiResponse.badRequest(res, 'Username already taken');
                }
                updateData.username = username;
            }

            if (password) {
                const passwordError = validatePassword(password);
                if (passwordError) {
                    return ApiResponse.badRequest(res, passwordError);
                }
                const salt = await bcrypt.genSalt(10);
                updateData.password_hash = await bcrypt.hash(password, salt);
            }

            if (profile_photo !== undefined) {
                updateData.profile_photo = profile_photo || null;
            }

            if (Object.keys(updateData).length === 0) {
                return ApiResponse.badRequest(res, 'No fields to update');
            }

            const { data: user, error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', userId)
                .select('id, full_name, email, phone, username, role, profile_photo')
                .single();

            if (error) {
                console.error('Profile update error:', error);
                return ApiResponse.error(res, 'Failed to update profile');
            }

            return ApiResponse.success(res, user, 'Profile updated');
        } catch (error) {
            return ApiResponse.error(res, 'Failed to update profile');
        }
    }
};

module.exports = authController;
