import { apiService } from './api.service.js';
import { CONFIG } from '../config/constants.js';

class AuthService {
    constructor() {
        this.user = null;
        this.token = localStorage.getItem('rikim_token');
        this.loadUser();
    }

    loadUser() {
        const userStr = localStorage.getItem('rikim_user');
        if (userStr) {
            try {
                this.user = JSON.parse(userStr);
            } catch (e) {
                this.user = null;
            }
        }
        // Attempt to fill missing staff_role on page reload
        if (this.user && this.user.role === 'staff' && !this.user.staff_role) {
            this.fetchAndSaveStaffRole();
        }
    }

    saveUser(user) {
        this.user = user;
        localStorage.setItem('rikim_user', JSON.stringify(user));
    }

    saveToken(token) {
        this.token = token;
        localStorage.setItem('rikim_token', token);
    }

    getRole() {
        return this.user?.role || null;
    }

    getStaffRole() {
        return this.user?.staff_role || null;
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    // ----------------------------------------------------------
    //  ENSURE staff_role IS PRESENT (called after login/setup)
    // ----------------------------------------------------------
    async fetchAndSaveStaffRole() {
        if (!this.user || !this.user.phone) return;
        try {
            const response = await apiService.get(`/staff/members/by-phone/${this.user.phone}`);
            if (response.success && response.data?.staff_role) {
                this.user.staff_role = response.data.staff_role;
                localStorage.setItem('rikim_user', JSON.stringify(this.user));
                console.log('[AuthService] staff_role set to:', this.user.staff_role);
            }
        } catch (error) {
            console.warn('[AuthService] Failed to fetch staff_role:', error);
        }
    }

    async login(phone, password) {
        const response = await apiService.post(CONFIG.ENDPOINTS.AUTH.LOGIN, { phone, password });
        if (response.success) {
            this.saveToken(response.data.token);
            this.saveUser(response.data.user);
            // staff missing? fetch it automatically
            if (this.user.role === 'staff' && !this.user.staff_role) {
                await this.fetchAndSaveStaffRole();
            }
        }
        return response;
    }

    async setup(full_name, phone, password) {
        const response = await apiService.post(CONFIG.ENDPOINTS.AUTH.SETUP, {
            full_name,
            phone,
            password,
            role: 'landlord'
        });
        if (response.success) {
            this.saveToken(response.data.token);
            this.saveUser(response.data.user);
            if (this.user.role === 'staff' && !this.user.staff_role) {
                await this.fetchAndSaveStaffRole();
            }
        }
        return response;
    }

    async register(userData) {
        return apiService.post(CONFIG.ENDPOINTS.AUTH.REGISTER, userData);
    }

    async getProfile() {
        return apiService.get(CONFIG.ENDPOINTS.AUTH.PROFILE);
    }

    async getUsers() {
        return apiService.get(CONFIG.ENDPOINTS.AUTH.USERS);
    }

    logout() {
        this.user = null;
        this.token = null;
        localStorage.removeItem('rikim_token');
        localStorage.removeItem('rikim_user');
        window.location.hash = '#/login';
        window.location.reload();
    }
}

export const authService = new AuthService();
