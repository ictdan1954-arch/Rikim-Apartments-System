import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { formatCurrency, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';

export default async function staffMembers(container) {
    const role = authService.getRole();
    let defaultAptId = null;
    let defaultAptName = '';

    // Caretaker: auto‑lock apartment
    if (role === 'caretaker') {
        const aptRes = await apiService.get('/apartments');
        if (aptRes.success && aptRes.data.length > 0) {
            defaultAptId = aptRes.data[0].id;
            defaultAptName = aptRes.data[0].name;
        }
    }

    // Local cache of members with account info (for caretaker, fetched from accounts endpoint)
    let membersWithAccounts = [];

    async function loadMembersWithAccounts() {
        const aptId = defaultAptId || '';
        if (!aptId) return;
        try {
            const res = await apiService.get(`/staff/members/apartment/${aptId}/accounts`);
            if (res.success) membersWithAccounts = res.data;
        } catch (e) { /* ignore */ }
    }

    if (role === 'caretaker') {
        await loadMembersWithAccounts();
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Staff Members${defaultAptName ? ` – ${defaultAptName}` : ''}</h3>
                <button class="btn btn-primary" id="add-member-btn"><i class="fas fa-plus"></i> Add Member</button>
            </div>
            <div class="filter-bar">
                <div class="search-bar" style="flex:1;">
                    <i class="fas fa-search"></i>
                    <input type="text" class="form-input" id="staff-search" placeholder="Search by name or phone...">
                </div>
                ${role === 'landlord' ? `
                <div class="form-group" style="min-width:180px;">
                    <select class="form-select" id="filter-apt"><option value="">All Apartments</option></select>
                </div>
                <div class="form-group" style="min-width:180px;">
                    <select class="form-select" id="filter-role"><option value="">All Roles</option></select>
                </div>` : ''}
            </div>
            <div id="staff-summary" class="mt-2" style="display:none;"></div>
            <div id="members-table" class="table-container"><div class="page-loader"><div class="spinner"></div></div></div>
        </div>`;

    const searchInput = container.querySelector('#staff-search');
    const filterApt = role === 'landlord' ? container.querySelector('#filter-apt') : null;
    const filterRole = role === 'landlord' ? container.querySelector('#filter-role') : null;
    const addBtn = container.querySelector('#add-member-btn');
    const membersTable = container.querySelector('#members-table');
    const summaryDiv = container.querySelector('#staff-summary');

    // Populate landlord dropdowns
    if (role === 'landlord') {
        const [aptRes, rolesRes] = await Promise.all([apiService.get('/apartments'), apiService.get('/staff/roles')]);
        if (aptRes.success) aptRes.data.forEach(a => filterApt.innerHTML += `<option value="${a.id}">${a.name}</option>`);
        if (rolesRes.success) rolesRes.data.forEach(r => filterRole.innerHTML += `<option value="${r.id}">${r.role_name}</option>`);
        filterApt.addEventListener('change', loadMembers);
        filterRole.addEventListener('change', loadMembers);
    }

    addBtn.addEventListener('click', openAddModal);

    // Debounced search
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadMembers, 300);
    });

    // If coming from Staff Roles page with a role parameter, pre‑select that role
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const roleFromUrl = urlParams.get('role');
    if (roleFromUrl && role === 'landlord' && filterRole) {
        filterRole.value = roleFromUrl;
    }

    let selectedAptId = defaultAptId || '';
    let selectedRoleId = role === 'landlord' && filterRole ? filterRole.value : '';

    async function loadMembers() {
        if (role === 'landlord') {
            selectedAptId = filterApt.value;    // '' means all
            selectedRoleId = filterRole.value;
        }
        const searchTerm = searchInput.value.trim().toLowerCase();

        // Caretaker: if no defaultAptId, show message
        if (role === 'caretaker' && !defaultAptId) {
            membersTable.innerHTML = `<p class="text-center p-3">No apartment assigned.</p>`;
            return;
        }

        let members = [];
        if (role === 'caretaker') {
            // Caretaker uses local cache (membersWithAccounts) and applies filters client-side
            members = membersWithAccounts;
            if (selectedRoleId) members = members.filter(m => m.staff_role_id === selectedRoleId);
            if (searchTerm) members = members.filter(m => m.full_name.toLowerCase().includes(searchTerm) || m.phone.includes(searchTerm));
        } else {
            // Landlord: fetch from backend (supports 'all' and individual apartment)
            const endpoint = selectedAptId
                ? `/staff/members/apartment/${selectedAptId}/accounts`
                : `/staff/members/apartment/all/accounts`;
            let query = '';
            if (selectedRoleId) query += `role_id=${selectedRoleId}&`;
            if (searchTerm) query += `search=${encodeURIComponent(searchTerm)}&`;
            const fullUrl = `${endpoint}${query ? '?' + query : ''}`;
            try {
                const res = await apiService.get(fullUrl);
                if (res.success) members = res.data;
            } catch (e) {
                membersTable.innerHTML = `<div class="error-state"><p>${e.message}</p></div>`;
                return;
            }
        }

        // --- Summary cards ---
        const total = members.length;
        const active = members.filter(m => m.status === 'active').length;
        const suspended = members.filter(m => m.status === 'suspended').length;
        const terminated = members.filter(m => m.status === 'terminated').length;

        summaryDiv.innerHTML = `
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <div class="stat-card"><div class="stat-icon primary"><i class="fas fa-users"></i></div><div class="stat-info"><div class="stat-label">Total</div><div class="stat-value">${total}</div></div></div>
                <div class="stat-card"><div class="stat-icon success"><i class="fas fa-check-circle"></i></div><div class="stat-info"><div class="stat-label">Active</div><div class="stat-value">${active}</div></div></div>
                <div class="stat-card"><div class="stat-icon warning"><i class="fas fa-pause-circle"></i></div><div class="stat-info"><div class="stat-label">Suspended</div><div class="stat-value">${suspended}</div></div></div>
                <div class="stat-card"><div class="stat-icon danger"><i class="fas fa-times-circle"></i></div><div class="stat-info"><div class="stat-label">Terminated</div><div class="stat-value">${terminated}</div></div></div>
            </div>
        `;
        summaryDiv.style.display = 'block';

        if (members.length === 0) {
            membersTable.innerHTML = `<div class="empty-state"><h3>No staff members found</h3></div>`;
            return;
        }

        // Show apartment column only for landlord when viewing "All Apartments"
        const showApartmentCol = role === 'landlord' && !selectedAptId;

        membersTable.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        ${showApartmentCol ? '<th>Apartment</th>' : ''}
                        <th>Role</th>
                        <th>Phone</th>
                        <th>Salary</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${members.map(m => {
                        const phone = m.phone;
                        const hasAccount = m.has_account;
                        const existingUser = m.user;
                        const roleName = (m.staff_roles?.role_name || '').toLowerCase();

                        let accountButton = '';
                        if (!hasAccount) {
                            if (roleName === 'caretaker') {
                                accountButton = `<button class="create-caretaker-btn" data-id="${m.id}" data-name="${m.full_name}" data-phone="${phone}" title="Create Caretaker Account"><i class="fas fa-user-plus"></i></button>`;
                            } else {
                                accountButton = `<button class="create-staff-account-btn" data-id="${m.id}" data-name="${m.full_name}" data-phone="${phone}" title="Create Account"><i class="fas fa-user-plus"></i></button>`;
                            }
                        } else {
                            accountButton = `<button class="edit-account-btn" data-id="${m.id}" data-name="${m.full_name}" data-phone="${phone}" data-username="${existingUser?.username || ''}" data-userid="${existingUser?.id || ''}" title="View / Edit Account"><i class="fas fa-eye"></i></button>`;
                        }

                        return `
                        <tr>
                            <td>${m.full_name}</td>
                            ${showApartmentCol ? `<td>${m.apartments?.name || 'N/A'}</td>` : ''}
                            <td>${m.staff_roles?.role_name || 'N/A'}</td>
                            <td>${phone}</td>
                            <td>${formatCurrency(m.monthly_salary)}</td>
                            <td><span class="badge badge-${m.status === 'active' ? 'success' : m.status === 'suspended' ? 'warning' : 'danger'}">${m.status}</span></td>
                            <td>
                                <div class="table-actions">
                                    <button class="edit-btn" data-id="${m.id}" title="Edit"><i class="fas fa-edit"></i></button>
                                    <button class="pay-btn" data-id="${m.id}" data-name="${m.full_name}" data-apt="${m.apartment_id}" title="Pay Salary"><i class="fas fa-money-bill"></i></button>
                                    ${accountButton}
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;

        // Event delegation (same as before)
        membersTable.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) { editStaffMember(editBtn.dataset.id); return; }
            const payBtn = e.target.closest('.pay-btn');
            if (payBtn) { paySalary(payBtn.dataset.id, payBtn.dataset.name, payBtn.dataset.apt); return; }
            const createCaretakerBtn = e.target.closest('.create-caretaker-btn');
            if (createCaretakerBtn) { createCaretakerAccount(createCaretakerBtn.dataset.id, createCaretakerBtn.dataset.name, createCaretakerBtn.dataset.phone); return; }
            const createStaffBtn = e.target.closest('.create-staff-account-btn');
            if (createStaffBtn) { createStaffAccount(createStaffBtn.dataset.id, createStaffBtn.dataset.name, createStaffBtn.dataset.phone); return; }
            const editAccountBtn = e.target.closest('.edit-account-btn');
            if (editAccountBtn) {
                editStaffAccount(editAccountBtn.dataset.id, editAccountBtn.dataset.name, editAccountBtn.dataset.phone, editAccountBtn.dataset.username, editAccountBtn.dataset.userid);
                return;
            }
        });
    }

    loadMembers();

    // ----- MODALS (unchanged) -----
    async function openAddModal() {
        const { showFormModal } = await import('../../components/modal.js');
        let apartmentsHtml = '', rolesHtml = '';

        if (role === 'landlord') {
            const [aptRes, rolesRes] = await Promise.all([apiService.get('/apartments'), apiService.get('/staff/roles')]);
            apartmentsHtml = aptRes.data?.map(a => `<option value="${a.id}">${a.name}</option>`).join('') || '';
            rolesHtml = rolesRes.data?.map(r => `<option value="${r.id}">${r.role_name}</option>`).join('') || '';
        } else {
            apartmentsHtml = `<option value="${defaultAptId}" selected>${defaultAptName}</option>`;
            const rolesRes = await apiService.get('/staff/roles');
            rolesHtml = rolesRes.success ? rolesRes.data.map(r => `<option value="${r.id}">${r.role_name}</option>`).join('') : '';
        }

        const formHtml = `
            <div class="form-group"><label class="form-label">Apartment</label><select class="form-select" id="mem-apt" ${role==='caretaker'?'disabled':''}>${apartmentsHtml}</select></div>
            <div class="form-group"><label class="form-label">Role</label><select class="form-select" id="mem-role">${rolesHtml}</select></div>
            <div class="form-group"><label class="form-label">Full Name <span class="required">*</span></label><input class="form-input" id="mem-name" required></div>
            <div class="form-group"><label class="form-label">Phone <span class="required">*</span></label><input class="form-input" id="mem-phone" required></div>
            <div class="form-group"><label class="form-label">Monthly Salary (KES) <span class="required">*</span></label><input type="number" class="form-input" id="mem-salary" min="0" step="100" required></div>
            <div class="form-group"><label class="form-label">Date Hired</label><input type="date" class="form-input" id="mem-date" value="${new Date().toISOString().split('T')[0]}"></div>`;

        showFormModal('Add Staff Member', formHtml, async (overlay) => {
            const aptId = role === 'caretaker' ? defaultAptId : overlay.querySelector('#mem-apt').value;
            const data = {
                apartment_id: aptId,
                staff_role_id: overlay.querySelector('#mem-role').value,
                full_name: overlay.querySelector('#mem-name').value.trim(),
                phone: overlay.querySelector('#mem-phone').value.trim(),
                monthly_salary: parseFloat(overlay.querySelector('#mem-salary').value),
                date_hired: overlay.querySelector('#mem-date').value
            };
            if (!data.full_name || !data.phone || !data.monthly_salary) { showToast('Fill all required fields', 'error'); return false; }
            try {
                await apiService.post('/staff/members', data);
                showToast('Staff member added', 'success');
                if (role === 'caretaker') await loadMembersWithAccounts();
                loadMembers();
            } catch (e) { showToast(e.message, 'error'); return false; }
        });
    }

    async function editStaffMember(memberId) {
        const response = await apiService.get(`/staff/members/${memberId}`);
        if (!response.success) { showToast('Could not fetch member details', 'error'); return; }
        const member = response.data;
        const rolesRes = await apiService.get('/staff/roles');
        const roles = rolesRes.success ? rolesRes.data : [];

        const formHtml = `
            <div class="form-group"><label class="form-label">Full Name</label><input type="text" class="form-input" id="edit-name" value="${member.full_name}"></div>
            <div class="form-group"><label class="form-label">Phone</label><input type="text" class="form-input" id="edit-phone" value="${member.phone}"></div>
            <div class="form-group"><label class="form-label">Role</label><select class="form-select" id="edit-role">${roles.map(r => `<option value="${r.id}" ${member.staff_role_id === r.id ? 'selected' : ''}>${r.role_name}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Monthly Salary</label><input type="number" class="form-input" id="edit-salary" value="${member.monthly_salary}" step="100" min="0"></div>
            <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="edit-status"><option value="active" ${member.status==='active'?'selected':''}>Active</option><option value="suspended" ${member.status==='suspended'?'selected':''}>Suspended</option><option value="terminated" ${member.status==='terminated'?'selected':''}>Terminated</option></select></div>
            <div class="form-group"><label class="form-label">Date Hired</label><input type="date" class="form-input" id="edit-date-hired" value="${member.date_hired || ''}"></div>
            <div class="form-group"><label class="form-label">ID Number</label><input type="text" class="form-input" id="edit-id-number" value="${member.id_number || ''}"></div>
            <div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="edit-notes" rows="2">${member.notes || ''}</textarea></div>`;

        const { showFormModal } = await import('../../components/modal.js');
        showFormModal('Edit Staff Member', formHtml, async (overlay) => {
            const updates = {
                full_name: overlay.querySelector('#edit-name').value.trim(),
                phone: overlay.querySelector('#edit-phone').value.trim(),
                staff_role_id: overlay.querySelector('#edit-role').value,
                monthly_salary: parseFloat(overlay.querySelector('#edit-salary').value),
                status: overlay.querySelector('#edit-status').value,
                date_hired: overlay.querySelector('#edit-date-hired').value,
                id_number: overlay.querySelector('#edit-id-number').value.trim(),
                notes: overlay.querySelector('#edit-notes').value.trim()
            };
            try {
                await apiService.put(`/staff/members/${memberId}`, updates);
                showToast('Staff member updated', 'success');
                if (role === 'caretaker') await loadMembersWithAccounts();
                loadMembers();
            } catch (e) { showToast(e.message, 'error'); return false; }
        });
    }

    async function createStaffAccount(staffId, name, phone) {
        const { showFormModal } = await import('../../components/modal.js');
        const defaultPassword = phone.replace(/\D/g, '').slice(-6) || '123456';
        const defaultUsername = name.toLowerCase().replace(/\s+/g, '') + '_' + phone.slice(-4);

        const formHtml = `
            <p>Create login account for <strong>${name}</strong> (${phone})</p>
            <div class="form-group"><label class="form-label">Username</label><input type="text" class="form-input" id="staff-username" value="${defaultUsername}" required></div>
            <div class="form-group"><label class="form-label">Password</label><input type="text" class="form-input" id="staff-password" value="${defaultPassword}"></div>`;

        showFormModal('Create Staff Account', formHtml, async (overlay) => {
            const username = overlay.querySelector('#staff-username').value.trim();
            const password = overlay.querySelector('#staff-password').value;
            if (!username || !password) { showToast('Username and password required', 'error'); return false; }
            try {
                const res = await apiService.post('/staff/accounts', { staff_id: staffId, username, password });
                const member = membersWithAccounts.find(m => m.id === staffId);
                if (member) {
                    member.user = { id: res.data?.id, phone, username, role: 'staff' };
                    member.has_account = true;
                }
                showToast(`Account created! Username: ${username}`, 'success');
                loadMembers();
            } catch (e) { showToast(e.message, 'error'); return false; }
        });
    }

    async function editStaffAccount(staffId, name, phone, currentUsername, userId) {
        const { showFormModal } = await import('../../components/modal.js');
        const formHtml = `
            <p>Edit account for <strong>${name}</strong> (${phone})</p>
            <div class="form-group"><label class="form-label">Username</label><input type="text" class="form-input" id="edit-staff-username" value="${currentUsername || ''}"></div>
            <div class="form-group"><label class="form-label">New Password (leave blank to keep current)</label><input type="password" class="form-input" id="edit-staff-password" placeholder="Min 6 characters"></div>`;

        showFormModal('Edit Staff Account', formHtml, async (overlay) => {
            const newUsername = overlay.querySelector('#edit-staff-username').value.trim();
            const newPassword = overlay.querySelector('#edit-staff-password').value;
            if (!newUsername) { showToast('Username is required', 'error'); return false; }
            const body = { username: newUsername };
            if (newPassword) {
                if (newPassword.length < 6) { showToast('Password min 6 characters', 'error'); return false; }
                body.password = newPassword;
            }
            try {
                await apiService.put(`/auth/users/${userId}`, body);
                const member = membersWithAccounts.find(m => m.id === staffId);
                if (member && member.user) member.user.username = newUsername;
                showToast('Account updated', 'success');
                loadMembers();
            } catch (e) { showToast(e.message, 'error'); return false; }
        });
    }

    async function createCaretakerAccount(staffId, name, phone) {
        const { showFormModal } = await import('../../components/modal.js');
        const defaultPassword = phone.replace(/\D/g, '').slice(-6) || '123456';
        const defaultUsername = name.toLowerCase().replace(/\s+/g, '') + '_' + phone.slice(-4);

        const formHtml = `
            <p>Create a caretaker login account for <strong>${name}</strong>.</p><p>Phone: <strong>${phone}</strong></p>
            <div class="form-group"><label class="form-label">Username</label><input type="text" class="form-input" id="caretaker-username" value="${defaultUsername}" required></div>
            <div class="form-group"><label class="form-label">Password</label>
                <div style="position: relative;"><input type="password" class="form-input" id="caretaker-password" value="${defaultPassword}" readonly style="padding-right: 40px;"><button type="button" class="password-toggle" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer;" onclick="const p = document.getElementById('caretaker-password'); if(p.type==='password'){p.type='text'; this.innerHTML='<i class=\\'fas fa-eye-slash\\'></i>';} else {p.type='password'; this.innerHTML='<i class=\\'fas fa-eye\\'></i>';}"><i class="fas fa-eye"></i></button></div>
            </div>`;

        showFormModal('Create Caretaker Account', formHtml, async (overlay) => {
            const username = overlay.querySelector('#caretaker-username').value.trim();
            const password = overlay.querySelector('#caretaker-password').value;
            if (!username) { showToast('Username required', 'error'); return false; }
            try {
                const res = await apiService.post('/auth/register', { full_name: name, phone: phone, password, role: 'caretaker', username });
                const member = membersWithAccounts.find(m => m.id === staffId);
                if (member) {
                    member.user = { id: res.data?.id, phone, username, role: 'caretaker' };
                    member.has_account = true;
                }
                showToast(`Caretaker account created! Username: ${username}`, 'success');
                loadMembers();
            } catch (e) { showToast(e.message, 'error'); return false; }
        });
    }

    function paySalary(staffId, name, aptId) {
        import('../../components/modal.js').then(({ showFormModal }) => {
            const formHtml = `
                <p>Record salary payment for <strong>${name}</strong></p>
                <div class="form-group"><label class="form-label">Amount (KES)</label><input type="number" class="form-input" id="sal-amount" min="1" required></div>
                <div class="form-group"><label class="form-label">Payment Date</label><input type="date" class="form-input" id="sal-date" value="${new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group"><label class="form-label">Period Start</label><input type="date" class="form-input" id="sal-start"></div>
                <div class="form-group"><label class="form-label">Period End</label><input type="date" class="form-input" id="sal-end"></div>
                <div class="form-group"><label class="form-label">Payment Method</label><select class="form-select" id="sal-method"><option>cash</option><option>mpesa</option><option>bank_transfer</option><option>other</option></select></div>`;

            showFormModal('Pay Salary', formHtml, async (overlay) => {
                const data = {
                    staff_id: staffId,
                    apartment_id: aptId,
                    amount_paid: parseFloat(overlay.querySelector('#sal-amount').value),
                    payment_date: overlay.querySelector('#sal-date').value,
                    period_start: overlay.querySelector('#sal-start').value,
                    period_end: overlay.querySelector('#sal-end').value,
                    payment_method: overlay.querySelector('#sal-method').value
                };
                if (!data.amount_paid || !data.payment_date || !data.period_start || !data.period_end) {
                    showToast('Please fill all required fields', 'error');
                    return false;
                }
                try {
                    await apiService.post('/staff/salaries', data);
                    showToast('Salary recorded', 'success');
                } catch (e) { showToast(e.message, 'error'); return false; }
            });
        });
    }
}
