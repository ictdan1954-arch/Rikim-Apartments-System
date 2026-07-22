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

    // =============================================
    // GET STAFF ROLE (for cleaners, etc.)
    // =============================================
    getStaffRole() {
        return this.user?.staff_role || null;
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    // =============================================
    // UPDATED: Accepts identifier (phone, email, or username)
    // =============================================
    async login(identifier, password) {
        const response = await apiService.post(CONFIG.ENDPOINTS.AUTH.LOGIN, { 
            identifier,  // ← Changed from 'phone' to 'identifier'
            password 
        });
        if (response.success) {
            this.saveToken(response.data.token);
            this.saveUser(response.data.user);
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
        }
        return response;
    }

    async register(userData) {
        const response = await apiService.post(CONFIG.ENDPOINTS.AUTH.REGISTER, userData);
        return response;
    }

    async getProfile() {
        return apiService.get(CONFIG.ENDPOINTS.AUTH.PROFILE);
    }

    async getUsers() {
        return apiService.get(CONFIG.ENDPOINTS.AUTH.USERS);
    }

    // =============================================
    // FIXED: Consistent storage keys
    // =============================================
    logout() {
        this.user = null;
        this.token = null;
        localStorage.removeItem('rikim_token');   // ← Fixed
        localStorage.removeItem('rikim_user');    // ← Fixed
        window.location.hash = '#/login';
        window.location.reload();
    }
}

export const authService = new AuthService();
