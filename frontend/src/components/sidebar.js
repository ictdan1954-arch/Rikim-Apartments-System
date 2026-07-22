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
    if (sidebar) sidebar.style.display = 'flex';

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
        role = staffRole;   // e.g., 'electrician', 'plumber', 'gardener'
    }

    // Build navigation using the (possibly overridden) role
    const nav = document.getElementById('sidebar-nav');
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
        } catch (e) {
            // leave default "My Apartments" if fetch fails
        }
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
        // Display the sub‑role name properly capitalised
        const knownRoles = {
            cleaner: 'Cleaner',
            electrician: 'Electrician',
            plumber: 'Plumber',
            gardener: 'Gardener'
        };
        if (knownRoles[staffRole]) {
            roleEl.textContent = knownRoles[staffRole];
        } else {
            // Fallback to main role with capitalisation
            roleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        }
    }

    if (avatarEl && user.profile_photo) {
        avatarEl.src = user.profile_photo;
    }
}

// =============================================
// PRIVATE: MENU DEFINITIONS
// =============================================
function getMenuItems(role) {
    // ---------- SUB‑ROLE MENUS ----------
    if (role === 'cleaner') {
        return [
            { section: 'MAIN', items: [
                { icon: 'fa-th-large', text: 'Dashboard', href: '/cleaning/dashboard' }
            ]},
            { section: 'MY WORK', items: [
                { icon: 'fa-tasks', text: 'My Tasks', href: '/cleaning/dashboard' },
                { icon: 'fa-box', text: 'Supplies', href: '/cleaning/dashboard' },
                { icon: 'fa-history', text: 'My Salary', href: '/cleaning/dashboard' },
                { icon: 'fa-envelope', text: 'Messages', href: '/cleaning/dashboard' }
            ]}
        ];
    }

    if (role === 'electrician') {
        return [
            { section: 'MAIN', items: [
                { icon: 'fa-th-large', text: 'Dashboard', href: '/electrician/dashboard' }
            ]},
            { section: 'MY WORK', items: [
                { icon: 'fa-tasks', text: 'My Tasks', href: '/electrician/dashboard' },
                { icon: 'fa-tools', text: 'Supplies', href: '/electrician/dashboard' },
                { icon: 'fa-history', text: 'My Salary', href: '/electrician/dashboard' },
                { icon: 'fa-envelope', text: 'Messages', href: '/electrician/dashboard' }
            ]}
        ];
    }

    if (role === 'plumber') {
        return [
            { section: 'MAIN', items: [
                { icon: 'fa-th-large', text: 'Dashboard', href: '/plumber/dashboard' }
            ]},
            { section: 'MY WORK', items: [
                { icon: 'fa-tasks', text: 'My Tasks', href: '/plumber/dashboard' },
                { icon: 'fa-wrench', text: 'Supplies', href: '/plumber/dashboard' },
                { icon: 'fa-history', text: 'My Salary', href: '/plumber/dashboard' },
                { icon: 'fa-envelope', text: 'Messages', href: '/plumber/dashboard' }
            ]}
        ];
    }

    if (role === 'gardener') {
        return [
            { section: 'MAIN', items: [
                { icon: 'fa-th-large', text: 'Dashboard', href: '/gardener/dashboard' }
            ]},
            { section: 'MY WORK', items: [
                { icon: 'fa-tasks', text: 'My Tasks', href: '/gardener/dashboard' },
                { icon: 'fa-seedling', text: 'Supplies', href: '/gardener/dashboard' },
                { icon: 'fa-history', text: 'My Salary', href: '/gardener/dashboard' },
                { icon: 'fa-envelope', text: 'Messages', href: '/gardener/dashboard' }
            ]}
        ];
    }

    // ---------- MAIN ROLE MENUS ----------
    const landlordMenu = [
        { section: 'MAIN', items: [{ icon: 'fa-th-large', text: 'Dashboard', href: '/dashboard' }] },
        { section: 'PROPERTIES', items: [
            { icon: 'fa-building', text: 'Apartments', href: '/apartments' },
            { icon: 'fa-door-open', text: 'Units', href: '/units/all' }
        ]},
        { section: 'PEOPLE', items: [
            { icon: 'fa-users', text: 'Tenants', href: '/tenants' },
            { icon: 'fa-user-tie', text: 'Staff Roles', href: '/staff/roles' },
            { icon: 'fa-user-friends', text: 'Staff Members', href: '/staff/members' }
        ]},
        { section: 'FINANCES', items: [
            { icon: 'fa-money-bill-wave', text: 'Rent Payments', href: '/payments/rent' },
            { icon: 'fa-hand-holding-usd', text: 'Staff Salaries', href: '/payments/salaries' },
            { icon: 'fa-receipt', text: 'Expenses', href: '/expenses' }
        ]},
        { section: 'MANAGEMENT', items: [
            { icon: 'fa-tools', text: 'Maintenance', href: '/maintenance' }
        ]}
    ];

    const caretakerMenu = [
        { section: 'MAIN', items: [{ icon: 'fa-th-large', text: 'Dashboard', href: '/dashboard' }] },
        { section: 'PROPERTIES', items: [
            { icon: 'fa-building', text: 'My Apartments', href: '/apartments' }
        ]},
        { section: 'PEOPLE', items: [
            { icon: 'fa-users', text: 'Tenants', href: '/tenants' },
            { icon: 'fa-user-friends', text: 'Staff Members', href: '/staff/members' }
        ]},
        { section: 'FINANCES', items: [
            { icon: 'fa-money-bill-wave', text: 'Rent Payments', href: '/payments/rent' },
            { icon: 'fa-hand-holding-usd', text: 'Staff Salaries', href: '/payments/salaries' },
            { icon: 'fa-receipt', text: 'Expenses', href: '/expenses' }
        ]},
        { section: 'MANAGEMENT', items: [
            { icon: 'fa-tools', text: 'Maintenance', href: '/maintenance' }
        ]}
    ];

    const tenantMenu = [
        { section: 'MAIN', items: [{ icon: 'fa-th-large', text: 'Dashboard', href: '/dashboard' }] },
        { section: 'MY STUFF', items: [
            { icon: 'fa-history', text: 'Payment History', href: '/tenants/my' },
            { icon: 'fa-tools', text: 'Maintenance', href: '/maintenance/tenant' },
            { icon: 'fa-envelope', text: 'Messages', href: '/messages' }
        ]}
    ];

    const staffMenu = [
        { section: 'MAIN', items: [{ icon: 'fa-th-large', text: 'Dashboard', href: '/dashboard' }] },
        { section: 'MY WORK', items: [
            { icon: 'fa-history', text: 'My Salary', href: '/dashboard' },
            { icon: 'fa-tasks', text: 'My Tasks', href: '/dashboard' },
            { icon: 'fa-bullhorn', text: 'Announcements', href: '/dashboard' }
        ]}
    ];

    // Fallback order
    if (role === 'landlord') return landlordMenu;
    if (role === 'caretaker') return caretakerMenu;
    if (role === 'tenant') return tenantMenu;
    if (role === 'staff') return staffMenu;   // only unknown sub‑roles land here
    return [];
}

// =============================================
// PRIVATE: RENDER NAVIGATION
// =============================================
function renderNav(container, menuItems) {
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
        // Highlight sub‑role dashboards
        const subRoleDashboards = ['/cleaning/dashboard', '/electrician/dashboard', '/plumber/dashboard', '/gardener/dashboard'];
        if (subRoleDashboards.includes(href) && currentHash.startsWith(href)) {
            link.classList.add('active');
        }
    });
}

// =============================================
// PRIVATE: TENANT MESSAGE HANDLER
// =============================================
function attachTenantMessageHandler() {
    const messagesLink = document.querySelector('.nav-link[data-href="/messages"]');
    if (!messagesLink) return;
    messagesLink.removeEventListener('click', tenantMessageClickHandler);
    messagesLink.addEventListener('click', tenantMessageClickHandler);
}

async function tenantMessageClickHandler(e) {
    e.preventDefault();
    try {
        const dashRes = await apiService.get('/dashboard/tenant');
        if (!dashRes.success || !dashRes.data.tenant) {
            showToast('Could not load your apartment info', 'error');
            return;
        }
        const tenant = dashRes.data.tenant;
        const caretakerRes = await apiService.get(`/apartments/${tenant.apartment_id}/caretakers`);
        if (!caretakerRes.success || !caretakerRes.data.length) {
            showToast('No caretaker assigned to your apartment', 'warning');
            return;
        }
        const caretakers = caretakerRes.data;
        if (caretakers.length === 1) {
            const c = caretakers[0];
            const { openChatModal } = await import('./chat.js');
            openChatModal(authService.user?.id, c.user_id, c.users?.full_name);
        } else {
            const { showFormModal } = await import('./modal.js');
            const formHtml = `
                <div class="form-group">
                    <label class="form-label">Select Caretaker</label>
                    <select class="form-select" id="caretaker-select">
                        ${caretakers.map(c => `<option value="${c.user_id}">${c.users?.full_name}</option>`).join('')}
                    </select>
                </div>`;
            showFormModal('Message Caretaker', formHtml, async (overlay) => {
                const selectedId = overlay.querySelector('#caretaker-select').value;
                const selectedName = caretakers.find(c => c.user_id === selectedId)?.users?.full_name;
                const { openChatModal } = await import('./chat.js');
                openChatModal(authService.user?.id, selectedId, selectedName);
            });
        }
    } catch (err) {
        showToast('Failed to load caretakers', 'error');
    }
}
