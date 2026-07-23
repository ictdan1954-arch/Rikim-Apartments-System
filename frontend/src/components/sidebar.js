import { authService } from '../services/auth.service.js';
import { apiService } from '../services/api.service.js';
import { showToast } from '../components/toast.js';
import { router } from '../router.js';

let hashChangeBound = false;

// =============================================
// PUBLIC: SETUP SIDEBAR (menu + interactivity)
// =============================================
export async function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    if (!authService.isAuthenticated()) {
        sidebar.style.display = 'none';
        return;
    }
    sidebar.style.setProperty('display', 'flex', 'important');

    // ---------- ENSURE staff_role ----------
    let role = authService.getRole();
    let staffRole = authService.getStaffRole();

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
            console.warn('[SIDEBAR] by-phone fetch failed:', e);
        }
    } else if (staffRole) {
        staffRole = staffRole.toLowerCase();
    }

    const knownSubRoles = ['cleaner', 'electrician', 'plumber', 'gardener'];
    if (role === 'staff' && staffRole && knownSubRoles.includes(staffRole)) {
        role = staffRole;
    }

    // Ensure navigation container exists
    let nav = document.getElementById('sidebar-nav');
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = 'sidebar-nav';
        sidebar.appendChild(nav);
    }

    const menuItems = getMenuItems(role);
    if (menuItems.length === 0) {
        nav.innerHTML = '<div style="padding:20px; color:#fff;">No menu available for this role.</div>';
    } else {
        renderNav(nav, menuItems);
    }

    // ----- Caretaker apartments -----
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
        } catch (e) { /* ignore */ }
    }

    // ----- Close sidebar on mobile -----
    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    });

    // ----- Tenant messages -----
    if (role === 'tenant') {
        attachTenantMessageHandler();
    }

    // ----- Profile modal -----
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

    // ----- User info, active link, etc. -----
    updateSidebarUserInfo();
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
    // Cleaner – links now point to section IDs within the dashboard
    if (role === 'cleaner') {
        return [
            { section: 'MAIN', items: [
                { icon: 'fa-th-large', text: 'Dashboard', href: '/cleaning/dashboard' }
            ]},
            { section: 'MY WORK', items: [
                { icon: 'fa-tasks', text: 'My Tasks', href: '#tasks' },
                { icon: 'fa-box', text: 'Supplies', href: '#supplies' },
                { icon: 'fa-history', text: 'My Salary', href: '#salary' },
                { icon: 'fa-envelope', text: 'Messages', href: '#messages' }
            ]}
        ];
    }

    // Electrician
    if (role === 'electrician') {
        return [
            { section: 'MAIN', items: [{ icon: 'fa-th-large', text: 'Dashboard', href: '/electrician/dashboard' }] },
            { section: 'MY WORK', items: [
                { icon: 'fa-tasks', text: 'My Tasks', href: '#tasks' },
                { icon: 'fa-tools', text: 'Supplies', href: '#supplies' },
                { icon: 'fa-history', text: 'My Salary', href: '#salary' },
                { icon: 'fa-envelope', text: 'Messages', href: '#messages' }
            ]}
        ];
    }

    // Plumber
    if (role === 'plumber') {
        return [
            { section: 'MAIN', items: [{ icon: 'fa-th-large', text: 'Dashboard', href: '/plumber/dashboard' }] },
            { section: 'MY WORK', items: [
                { icon: 'fa-tasks', text: 'My Tasks', href: '#tasks' },
                { icon: 'fa-wrench', text: 'Supplies', href: '#supplies' },
                { icon: 'fa-history', text: 'My Salary', href: '#salary' },
                { icon: 'fa-envelope', text: 'Messages', href: '#messages' }
            ]}
        ];
    }

    // Gardener
    if (role === 'gardener') {
        return [
            { section: 'MAIN', items: [{ icon: 'fa-th-large', text: 'Dashboard', href: '/gardener/dashboard' }] },
            { section: 'MY WORK', items: [
                { icon: 'fa-tasks', text: 'My Tasks', href: '#tasks' },
                { icon: 'fa-seedling', text: 'Supplies', href: '#supplies' },
                { icon: 'fa-history', text: 'My Salary', href: '#salary' },
                { icon: 'fa-envelope', text: 'Messages', href: '#messages' }
            ]}
        ];
    }

    // Landlord
    if (role === 'landlord') {
        return [
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
    }

    // Caretaker
    if (role === 'caretaker') {
        return [
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
    }

    // Tenant
    if (role === 'tenant') {
        return [
            { section: 'MAIN', items: [{ icon: 'fa-th-large', text: 'Dashboard', href: '/dashboard' }] },
            { section: 'MY STUFF', items: [
                { icon: 'fa-history', text: 'Payment History', href: '/tenants/my' },
                { icon: 'fa-tools', text: 'Maintenance', href: '/maintenance/tenant' },
                { icon: 'fa-envelope', text: 'Messages', href: '/messages' }
            ]}
        ];
    }

    // Unknown role
    return [];
}

// =============================================
// PRIVATE: RENDER NAVIGATION
// =============================================
function renderNav(container, menuItems) {
    if (!container) return;
    let html = '';
    menuItems.forEach(section => {
        html += `<div class="nav-section">
            <div class="nav-section-title">${section.section}</div>`;
        section.items.forEach(item => {
            html += `
                <a class="nav-link" href="${item.href.startsWith('#') ? item.href : '#' + item.href}" data-href="${item.href}">
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
        if (href && (currentHash.startsWith(href) || 
            (href === '/dashboard' && currentHash === '/dashboard') ||
            (href.startsWith('#') && window.location.hash === href))) {
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
