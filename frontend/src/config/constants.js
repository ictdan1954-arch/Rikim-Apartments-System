// API Configuration
const API_BASE_URL = 'https://rikim-apartments-system.onrender.com/api';

export const CONFIG = {
    API_URL: API_BASE_URL,
    SUPABASE_URL: 'https://hllxrantzwrnbnnwmmav.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_dogAnah8du4c6fhk_FMCbg_6inR-ebz',
    
    ENDPOINTS: {
        AUTH: {
            LOGIN: '/auth/login',
            SETUP: '/auth/setup',
            REGISTER: '/auth/register',
            PROFILE: '/auth/profile',
            USERS: '/auth/users'
        },
        APARTMENTS: '/apartments',
        UNITS: '/units',
        TENANTS: '/tenants',
        RENT: '/rent',
        EXPENSES: '/expenses',
        STAFF: '/staff',
        MAINTENANCE: '/maintenance',
        DASHBOARD: '/dashboard'
    },
    
    ROLES: {
        LANDLORD: 'landlord',
        CARETAKER: 'caretaker',
        TENANT: 'tenant'
    },
    
    UNIT_TYPES: ['single', 'bedsitter', 'one_bedroom', 'two_bedroom', 'three_bedroom', 'other'],
    PAYMENT_METHODS: ['cash', 'mpesa', 'bank_transfer', 'other'],
    EXPENSE_CATEGORIES: ['maintenance', 'utilities', 'salary', 'cleaning', 'repairs', 'other'],
    PRIORITIES: ['low', 'medium', 'high', 'urgent'],
    MAINTENANCE_STATUSES: ['reported', 'in_progress', 'resolved', 'cancelled'],
    TENANT_STATUSES: ['active', 'moved_out', 'blacklisted'],
    UNIT_STATUSES: ['vacant', 'occupied', 'under_maintenance']
};
