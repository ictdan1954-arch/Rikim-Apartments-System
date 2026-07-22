import { authService } from '../services/auth.service.js';
import { apiService } from '../services/api.service.js';
import { showToast } from '../components/toast.js';
import { router } from '../router.js';

let hashChangeBound = false;

// =============================================
// PUBLIC: SETUP SIDEBAR (menu + interactivity)
// =============================================
export async function setupSidebar() {
    if (!authService.isAuthenticated()) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.style.display = 'none';
        return;
    }

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;   // safety check
    sidebar.style.display = 'flex';

    // ---------- ENSURE staff_role IS AVAILABLE ----------
    let role = authService.getRole();
    let staffRole = authService.getStaffRole();

    // If staff_role missing, fetch it from the backend
    if (role === 'staff' && !staffRole) {
        try {
            const phone = authService.user.phone;
            const response = await apiService.get(`/staff/members/by-phone/${phone}`);
            if (response.success && response.data?.staff_role) {
                staffRole = response.data.staff_role.toLowerCase();
                authService.user.staff_role = staffRole;
                localStorage.setItem('rikim_user', JSON.stringify(authService.user));
            }
        } catch (e) {
            console.warn('Could not fetch staff_role, using generic staff menu');
        }
    } else if (staffRole) {
        staffRole = staffRole.toLowerCase();
    }

    // Override the main role for any known staff sub‑role
    const knownSubRoles = ['cleaner', 'electrician', 'plumber', 'gardener'];
    if (role === 'staff' && staffRole && knownSubRoles.includes(staffRole)) {
        role = staffRole;
    }

    // Build navigation (with null check)
    const nav = document.getElementById('sidebar-nav');
    if (!nav) {
        console.error('Sidebar nav element #sidebar-nav not found in the DOM');
        return;
    }
    const menuItems = getMenuItems(role);
    renderNav(nav, menuItems);

    // ----- Caretaker: replace generic "My Apartments" with actual assigned apartments -----
    if (role === 'caretaker') {
        try {
            const response = await apiService.get('/apartments');
            if (response.success && response.data.length > 0) {
                const apartments = response.data;
                const apartmentsHtml = apartments.map(a => `
                    <a class="nav-link" href="#/apartments/${a.id}" data-href="/apartments/${a.id}">
                        <i class="fas fa-building"></i>
                        <span class="nav-text">${a.name}</span>
                    </a>
                `).join('');

                const sections = nav.querySelectorAll('.nav-section');
                sections.forEach(section => {
                    const titleEl = section.querySelector('.nav-section-title');
                    if (titleEl && titleEl.textContent === 'PROPERTIES') {
                        const existingLinks = section.querySelectorAll('.nav-link');
                        existingLinks.forEach(link => link.remove());
                        section.insertAdjacentHTML('beforeend', apartmentsHtml);
                    }
                });
            }
        } catch (e) { /* leave default */ }
    }

    // ----- Attach click handlers to close sidebar on mobile -----
    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    });

    // ----- Tenant messages handler -----
    if (role === 'tenant') {
        attachTenantMessageHandler();
    }

    // ----- Profile modal (click on user info) -----
    const userInfoEl = document.querySelector('.user-info');
    if (userInfoEl) {
        userInfoEl.style.cursor = 'pointer';
        if (userInfoEl._clickHandler) {
            userInfoEl.removeEventListener('click', userInfoEl._clickHandler);
        }
        const clickHandler = async () => {
            const { openProfileModal } = await import('./profile.js');
            openProfileModal();
        };
        userInfoEl._clickHandler = clickHandler;
        userInfoEl.addEventListener('click', clickHandler);
    }

    // ----- User info (name, role, avatar) -----
    updateSidebarUserInfo();

    // ----- Active link highlighting -----
    updateActiveLink();
    if (!hashChangeBound) {
        window.addEventListener('hashchange', updateActiveLink);
        hashChangeBound = true;
    }
}

// =============================================
// PUBLIC: UPDATE USER INFO IN SIDEBAR
// =============================================
export function updateSidebarUserInfo() {
    const user = authService.user;
    if (!user) return;

    const nameEl = document.getElementById('user-name');
    const roleEl = document.getElementById('user-role');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = user.full_name;

    if (roleEl) {
        const staffRole = (user.staff_role || '').toLowerCase();
        const knownRoles = {
            cleaner: 'Cleaner',
            electrician: 'Electrician',
            plumber: 'Plumber',
            gardener: 'Gardener'
        };
        roleEl.textContent = knownRoles[staffRole] || 
            (user.role.charAt(0).toUpperCase() + user.role.slice(1));
    }

    if (avatarEl && user.profile_photo) {
        avatarEl.src = user.profile_photo;
    }
}

// =============================================
// PRIVATE: MENU DEFINITIONS
// =============================================
function getMenuItems(role) {
    if (role === 'cleaner') {
        return [
            { section: 'MAIN', items: [{ icon: 'fa-th-large', text: 'Dashboard', href: '/cleaning/dashboard' }] },
            { section: 'MY WORK', items: [
                { icon: 'fa-tasks', text: 'My Tasks', href: '/cleaning/dashboard' },
                { icon: 'fa-box', text: 'Supplies', href: '/cleaning/dashboard' },
                { icon: 'fa-history', text: 'My Salary', href: '/cleaning/dashboard' },
                { icon: 'fa-envelope', text: 'Messages', href: '/cleaning/dashboard' }
            ]}
        ];
    }
    if (role === 'electrician') { /* ... same pattern ... */ }
    if (role === 'plumber') { /* ... */ }
    if (role === 'gardener') { /* ... */ }

    // (Landlord, caretaker, tenant, staff menus – unchanged)
    // ...
    // fallback
    if (role === 'landlord') return landlordMenu;
    if (role === 'caretaker') return caretakerMenu;
    if (role === 'tenant') return tenantMenu;
    if (role === 'staff') return staffMenu;
    return [];
}

// =============================================
// PRIVATE: RENDER NAVIGATION (with null guard)
// =============================================
function renderNav(container, menuItems) {
    if (!container) return;   // <-- prevents the crash
    let html = '';
    menuItems.forEach(section => {
        html += `<div class="nav-section">
            <div class="nav-section-title">${section.section}</div>`;
        section.items.forEach(item => {
            html += `
                <a class="nav-link" href="#${item.href}" data-href="${item.href}">
                    <i class="fas ${item.icon}"></i>
                    <span class="nav-text">${item.text}</span>
                </a>`;
        });
        html += `</div>`;
    });
    container.innerHTML = html;
}

// =============================================
// PRIVATE: ACTIVE LINK HIGHLIGHTING
// =============================================
function updateActiveLink() {
    const currentHash = window.location.hash.slice(1) || '/dashboard';
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.dataset.href;
        link.classList.remove('active');
        if (currentHash.startsWith(href) || (href === '/dashboard' && currentHash === '/dashboard')) {
            link.classList.add('active');
        }
        const subRoleDashboards = ['/cleaning/dashboard', '/electrician/dashboard', '/plumber/dashboard', '/gardener/dashboard'];
        if (subRoleDashboards.includes(href) && currentHash.startsWith(href)) {
            link.classList.add('active');
        }
    });
}

// =============================================
// PRIVATE: TENANT MESSAGE HANDLER
// =============================================
// (unchanged)
