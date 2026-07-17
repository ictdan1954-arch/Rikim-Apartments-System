import { apiService } from './api.service.js';
import { CONFIG } from '../config/constants.js';

class AuthService {
    constructor() {
        this.user = null;
        this.token = localStorage.getItem('bandaptai_token');
        this.loadUser();
    }

    loadUser() {
        const userStr = localStorage.getItem('bandaptai_user');
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
        localStorage.setItem('bandaptai_user', JSON.stringify(user));
    }

    saveToken(token) {
        this.token = token;
        localStorage.setItem('bandaptai_token', token);
    }

    getRole() {
        return this.user?.role || null;
    }

    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    async login(phone, password) {
        const response = await apiService.post(CONFIG.ENDPOINTS.AUTH.LOGIN, { phone, password });
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

    logout() {
        this.user = null;
        this.token = null;
        localStorage.removeItem('bandaptai_token');
        localStorage.removeItem('bandaptai_user');
        window.location.hash = '#/login';
        window.location.reload();
    }
}

export const authService = new AuthService();
