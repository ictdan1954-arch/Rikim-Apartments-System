import { router } from './router.js';
import { authService } from './services/auth.service.js';
import { setupSidebar } from './components/sidebar.js';
import { setupNotifications } from './components/notifications.js';

// =============================================
// ROUTE DEFINITIONS
// =============================================

// Auth
router.addRoute('/login', {
    title: 'Login',
    auth: false,
    component: () => import('./pages/login.js')
});

router.addRoute('/setup', {
    title: 'System Setup',
    auth: false,
    component: () => import('./pages/setup.js')
});

// Dashboard – now includes staff
router.addRoute('/dashboard', {
    title: 'Dashboard',
    auth: true,
    role: ['landlord', 'caretaker', 'tenant', 'staff'],
    component: () => import('./pages/dashboard/dashboard.js')
});

// =============================================
// CLEANER DASHBOARD (NEW ROUTE)
// =============================================
router.addRoute('/cleaning/dashboard', {
    title: 'Cleaner Dashboard',
    auth: true,
    role: ['cleaner'],
    component: () => import('./pages/cleaning/dashboard.js')
});

// Apartments
router.addRoute('/apartments', {
    title: 'Apartments',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/apartments/list.js')
});

router.addRoute('/apartments/:id', {
    title: 'Apartment Details',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/apartments/details.js')
});

// Units
router.addRoute('/units/:apartmentId', {
    title: 'Units',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/units/list.js')
});

// Tenants
router.addRoute('/tenants', {
    title: 'Tenants',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/tenants/list.js')
});

router.addRoute('/tenants/register', {
    title: 'Register Tenant',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/tenants/register.js')
});

router.addRoute('/tenants/:id', {
    title: 'Tenant Details',
    auth: true,
    role: ['landlord', 'caretaker', 'tenant'],
    component: () => import('./pages/tenants/details.js')
});

// Rent Payments
router.addRoute('/payments/rent', {
    title: 'Rent Payments',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/payments/rent.js')
});

// Staff Salaries
router.addRoute('/payments/salaries', {
    title: 'Staff Salaries',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/payments/salaries.js')
});

// Expenses
router.addRoute('/expenses', {
    title: 'Expenses',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/expenses/list.js')
});

// Staff
router.addRoute('/staff/roles', {
    title: 'Staff Roles',
    auth: true,
    role: ['landlord'],
    component: () => import('./pages/staff/roles.js')
});

router.addRoute('/staff/members', {
    title: 'Staff Members',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/staff/members.js')
});

// Maintenance
router.addRoute('/maintenance', {
    title: 'Maintenance',
    auth: true,
    role: ['landlord', 'caretaker'],
    component: () => import('./pages/maintenance/list.js')
});

router.addRoute('/maintenance/tenant', {
    title: 'My Maintenance Requests',
    auth: true,
    role: ['tenant'],
    component: () => import('./pages/maintenance/tenant.js')
});

// =============================================
// APP INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    // Setup sidebar
    setupSidebar();
    
    // Setup notifications
    setupNotifications();
    
    // Setup logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        authService.logout();
    });

    // Handle sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // Handle mobile menu
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Update user info in sidebar
    updateUserInfo();
    
    // Start router
    router.handleRoute();
});

// =============================================
// UPDATE USER INFO IN SIDEBAR
// =============================================
function updateUserInfo() {
    const user = authService.user;
    if (user) {
        document.getElementById('user-name').textContent = user.full_name;
        
        // Display role: show 'Cleaner' if staff_role is cleaner, otherwise main role
        let displayRole = user.role;
        if (user.staff_role === 'cleaner') {
            displayRole = 'Cleaner';
        } else {
            displayRole = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        }
        document.getElementById('user-role').textContent = displayRole;
        
        if (user.profile_photo) {
            document.getElementById('user-avatar').src = user.profile_photo;
        }
    }
}

// Export for global access
window.router = router;
window.authService = authService;
