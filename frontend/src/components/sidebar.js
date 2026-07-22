import { authService } from '../services/auth.service.js';
import { apiService } from '../services/api.service.js';
import { showToast } from '../components/toast.js';
import { router } from '../router.js';

// Track whether we've already bound the hashchange listener
let hashChangeBound = false;

// =============================================
// PUBLIC: SETUP SIDEBAR (menu + interactivity)
// =============================================
export async function setupSidebar() {
    if (!authService.isAuthenticated()) {
        // User not logged in – hide sidebar
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.style.display = 'none';
        return;
    }

    // Make sidebar visible
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'flex';

    const nav = document.getElementById('sidebar-nav');
    const role = authService.getRole();
    const menuItems = getMenuItems(role);

    // Render the navigation
    renderNav(nav, menuItems);

    // Caretaker: replace generic "My Apartments" with actual apartment list
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
            // leave default "My Apartments" link if fetch fails
        }
    }

    // Re-attach click handlers to all navigation links (including new ones)
    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    });

    // Attach messages handler for tenants
    if (role === 'tenant') {
        attachTenantMessageHandler();
    }

    // =============================================
    // PROFILE MODAL (click on user info area)
    // =============================================
    const userInfoEl = document.querySelector('.user-info');
    if (userInfoEl) {
        userInfoEl.style.cursor = 'pointer';
        // Remove any previous click listener to avoid duplicate modals
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

    // Avatar update (run here + can also be called standalone)
    updateSidebarUserInfo();

    // Highlight active link
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
        let displayRole = user.role;
        if (user.staff_role === 'cleaner') {
            displayRole = 'Cleaner';
        } else {
            displayRole = user.role.charAt(0).toUpperCase() + user.role.slice(1);
        }
        roleEl.textContent = displayRole;
    }

    if (avatarEl && user.profile_photo) {
        avatarEl.src = user.profile_photo;
    }
}

// =============================================
// PRIVATE HELPERS
// =============================================

function getMenuItems(role) {
    // (unchanged – your original menu definitions)
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

    if (role === 'landlord') return landlordMenu;
    if (role === 'caretaker') return caretakerMenu;
    if (role === 'tenant') return tenantMenu;
    if (role === 'staff') return staffMenu;
    return [];
}

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

function updateActiveLink() {
    const currentHash = window.location.hash.slice(1) || '/dashboard';
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.dataset.href;
        link.classList.remove('active');
        if (currentHash.startsWith(href) || (href === '/dashboard' && currentHash === '/dashboard')) {
            link.classList.add('active');
        }
    });
}

function attachTenantMessageHandler() {
    const messagesLink = document.querySelector('.nav-link[data-href="/messages"]');
    if (!messagesLink) return;
    // Remove old listener to prevent duplicates
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
