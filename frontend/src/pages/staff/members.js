import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { formatCurrency, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';

export default async function staffMembers(container) {
    const role = authService.getRole();
    const userId = authService.user?.id;
    let defaultAptId = null;
    let defaultAptName = '';

    // If caretaker, fetch their assigned apartment(s) automatically
    if (role === 'caretaker') {
        try {
            const res = await apiService.get('/apartments');
            if (res.success && res.data.length > 0) {
                // Use the first assigned apartment
                defaultAptId = res.data[0].id;
                defaultAptName = res.data[0].name;
            }
        } catch (e) { /* ignore, will show no apartment message */ }
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Staff Members${defaultAptName ? ` – ${defaultAptName}` : ''}</h3>
                <button class="btn btn-primary" id="add-member-btn">
                    <i class="fas fa-plus"></i> Add Member
                </button>
            </div>
            ${role === 'landlord' ? `
            <div class="filter-bar">
                <select class="form-select" id="filter-apt">
                    <option value="">All Apartments</option>
                </select>
                <select class="form-select" id="filter-role">
                    <option value="">All Roles</option>
                </select>
            </div>` : ''}
            <div id="members-table" class="table-container">
                <div class="page-loader"><div class="spinner"></div></div>
            </div>
        </div>`;

    const filterApt = role === 'landlord' ? container.querySelector('#filter-apt') : null;
    const filterRole = role === 'landlord' ? container.querySelector('#filter-role') : null;
    const addBtn = container.querySelector('#add-member-btn');
    const membersTable = container.querySelector('#members-table');

    // Populate filters (landlord only)
    if (role === 'landlord') {
        const [aptRes, rolesRes] = await Promise.all([
            apiService.get('/apartments'),
            apiService.get('/staff/roles')
        ]);
        if (aptRes.success) {
            aptRes.data.forEach(a => {
                filterApt.innerHTML += `<option value="${a.id}">${a.name}</option>`;
            });
        }
        if (rolesRes.success) {
            rolesRes.data.forEach(r => {
                filterRole.innerHTML += `<option value="${r.id}">${r.role_name}</option>`;
            });
        }
        filterApt.addEventListener('change', () => loadMembers());
        filterRole.addEventListener('change', () => loadMembers());
    }

    addBtn.addEventListener('click', () => openAddModal());

    // For caretaker, apartment is fixed
    let selectedAptId = defaultAptId || '';
    let selectedRoleId = '';

    async function loadMembers() {
        if (role === 'landlord') {
            selectedAptId = filterApt.value;
            selectedRoleId = filterRole.value;
        }
        if (!selectedAptId) {
            membersTable.innerHTML = `<p class="text-center p-3">${role === 'caretaker' ? 'No apartment assigned yet.' : 'Select an apartment to view staff.'}</p>`;
            return;
        }

        let query = `apartment/${selectedAptId}`;
        if (selectedRoleId) query += `?role_id=${selectedRoleId}`;

        try {
            const response = await apiService.get(`/staff/members/${query}`);
            let members = response.success ? response.data : [];

            // For caretaker: put their own record (role caretaker) first
            if (role === 'caretaker' && members.length > 0) {
                members = [...members].sort((a, b) => {
                    const aIsCaretaker = a.staff_roles?.role_name?.toLowerCase() === 'caretaker';
                    const bIsCaretaker = b.staff_roles?.role_name?.toLowerCase() === 'caretaker';
                    if (aIsCaretaker && !bIsCaretaker) return -1;
                    if (!aIsCaretaker && bIsCaretaker) return 1;
                    return 0;
                });
            }

            if (members.length === 0) {
                membersTable.innerHTML = `<div class="empty-state"><h3>No staff members</h3></div>`;
                return;
            }

            membersTable.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Phone</th>
                            <th>Salary</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${members.map(m => `
                            <tr>
                                <td>${m.full_name}</td>
                                <td>${m.staff_roles?.role_name || 'N/A'}</td>
                                <td>${m.phone}</td>
                                <td>${formatCurrency(m.monthly_salary)}</td>
                                <td>
                                    <span class="badge badge-${m.status === 'active' ? 'success' : 'danger'}">
                                        ${m.status}
                                    </span>
                                </td>
                                <td>
                                    <div class="table-actions">
                                        <button class="edit-btn" data-id="${m.id}" title="Edit">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="pay-btn" data-id="${m.id}" data-name="${m.full_name}" data-apt="${selectedAptId}" title="Pay Salary">
                                            <i class="fas fa-money-bill"></i>
                                        </button>
                                        ${role === 'landlord' ? `
                                        <button class="caretaker-btn" data-id="${m.id}" data-name="${m.full_name}" data-phone="${m.phone}" title="Create Caretaker Account">
                                            <i class="fas fa-user-plus"></i>
                                        </button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;

            // Event delegation
            membersTable.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.edit-btn');
                if (editBtn) {
                    editStaffMember(editBtn.dataset.id);
                    return;
                }
                const payBtn = e.target.closest('.pay-btn');
                if (payBtn) {
                    paySalary(payBtn.dataset.id, payBtn.dataset.name, payBtn.dataset.apt);
                    return;
                }
                const caretakerBtn = e.target.closest('.caretaker-btn');
                if (caretakerBtn) {
                    createCaretakerAccount(caretakerBtn.dataset.id, caretakerBtn.dataset.name, caretakerBtn.dataset.phone);
                    return;
                }
            });

        } catch (e) {
            membersTable.innerHTML = `<div class="error-state"><p>${e.message}</p></div>`;
        }
    }

    // Initial load
    loadMembers();

    // ========== Modal functions ==========
    async function openAddModal() {
        const { showFormModal } = await import('../../components/modal.js');
        let apartmentsHtml = '';
        let rolesHtml = '';

        if (role === 'landlord') {
            const [aptRes, rolesRes] = await Promise.all([
                apiService.get('/apartments'),
                apiService.get('/staff/roles')
            ]);
            apartmentsHtml = aptRes.data?.map(a => `<option value="${a.id}">${a.name}</option>`).join('') || '';
            rolesHtml = rolesRes.data?.map(r => `<option value="${r.id}">${r.role_name}</option>`).join('') || '';
        } else {
            // Caretaker: fixed apartment
            apartmentsHtml = `<option value="${defaultAptId}" selected>${defaultAptName}</option>`;
            const rolesRes = await apiService.get('/staff/roles');
            rolesHtml = rolesRes.success ? rolesRes.data.map(r => `<option value="${r.id}">${r.role_name}</option>`).join('') : '';
        }

        const formHtml = `
            <div class="form-group">
                <label class="form-label">Apartment</label>
                <select class="form-select" id="mem-apt" ${role === 'caretaker' ? 'disabled' : ''}>
                    ${apartmentsHtml}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Role</label>
                <select class="form-select" id="mem-role">
                    ${rolesHtml}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Full Name <span class="required">*</span></label>
                <input class="form-input" id="mem-name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Phone <span class="required">*</span></label>
                <input class="form-input" id="mem-phone" required>
            </div>
            <div class="form-group">
                <label class="form-label">Monthly Salary (KES) <span class="required">*</span></label>
                <input type="number" class="form-input" id="mem-salary" min="0" step="100" required>
            </div>
            <div class="form-group">
                <label class="form-label">Date Hired</label>
                <input type="date" class="form-input" id="mem-date" value="${new Date().toISOString().split('T')[0]}">
            </div>`;

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

            if (!data.full_name || !data.phone || !data.monthly_salary) {
                showToast('Fill all required fields', 'error');
                return false;
            }
            try {
                await apiService.post('/staff/members', data);
                showToast('Staff member added', 'success');
                loadMembers();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        });
    }

    // The remaining functions (editStaffMember, createCaretakerAccount, paySalary) are unchanged
    // from the previous version — omitted for brevity but must be included exactly as before.
    // I'll include them here for completeness.

    async function editStaffMember(memberId) {
        const response = await apiService.get(`/staff/members/${memberId}`);
        if (!response.success) {
            showToast('Could not fetch member details', 'error');
            return;
        }
        const member = response.data;

        const rolesRes = await apiService.get('/staff/roles');
        const roles = rolesRes.success ? rolesRes.data : [];

        const formHtml = `
            <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" class="form-input" id="edit-name" value="${member.full_name}">
            </div>
            <div class="form-group">
                <label class="form-label">Phone</label>
                <input type="text" class="form-input" id="edit-phone" value="${member.phone}">
            </div>
            <div class="form-group">
                <label class="form-label">Role</label>
                <select class="form-select" id="edit-role">
                    ${roles.map(r => `<option value="${r.id}" ${member.staff_role_id === r.id ? 'selected' : ''}>${r.role_name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Monthly Salary (KES)</label>
                <input type="number" class="form-input" id="edit-salary" value="${member.monthly_salary}" step="100" min="0">
            </div>
            <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="edit-status">
                    <option value="active" ${member.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="suspended" ${member.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                    <option value="terminated" ${member.status === 'terminated' ? 'selected' : ''}>Terminated</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Date Hired</label>
                <input type="date" class="form-input" id="edit-date-hired" value="${member.date_hired || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">ID Number</label>
                <input type="text" class="form-input" id="edit-id-number" value="${member.id_number || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Notes</label>
                <textarea class="form-textarea" id="edit-notes" rows="2">${member.notes || ''}</textarea>
            </div>`;

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
                loadMembers();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        });
    }

    async function createCaretakerAccount(staffId, name, phone) {
        const { showFormModal } = await import('../../components/modal.js');
        const defaultPassword = phone.replace(/\D/g, '').slice(-6) || '123456';
        const defaultUsername = name.toLowerCase().replace(/\s+/g, '') + '_' + phone.slice(-4);

        const formHtml = `
            <p>Create a caretaker login account for <strong>${name}</strong>.</p>
            <p>Phone: <strong>${phone}</strong></p>
            <div class="form-group">
                <label class="form-label">Username <span class="required">*</span></label>
                <input type="text" class="form-input" id="caretaker-username" value="${defaultUsername}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Password</label>
                <div style="position: relative;">
                    <input type="password" class="form-input" id="caretaker-password" value="${defaultPassword}" readonly style="padding-right: 40px;">
                    <button type="button" class="password-toggle" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer;"
                            onclick="const pwd = document.getElementById('caretaker-password'); if(pwd.type === 'password') { pwd.type = 'text'; this.innerHTML = '<i class=\\'fas fa-eye-slash\\'></i>'; } else { pwd.type = 'password'; this.innerHTML = '<i class=\\'fas fa-eye\\'></i>'; }">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
                <small class="text-muted">Default password is the last 6 digits of the phone number.</small>
            </div>`;

        showFormModal('Create Caretaker Account', formHtml, async (overlay) => {
            const username = overlay.querySelector('#caretaker-username').value.trim();
            const password = overlay.querySelector('#caretaker-password').value;

            if (!username) {
                showToast('Username is required', 'error');
                return false;
            }
            try {
                await apiService.post('/auth/register', {
                    full_name: name,
                    phone: phone,
                    password: password,
                    role: 'caretaker',
                    username: username
                });
                showToast(`Caretaker account created! Username: ${username}`, 'success');
                loadMembers();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        });
    }

    function paySalary(staffId, name, aptId) {
        import('../../components/modal.js').then(({ showFormModal }) => {
            const formHtml = `
                <p>Record salary payment for <strong>${name}</strong></p>
                <div class="form-group">
                    <label class="form-label">Amount (KES) <span class="required">*</span></label>
                    <input type="number" class="form-input" id="sal-amount" min="1" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Payment Date</label>
                    <input type="date" class="form-input" id="sal-date" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label class="form-label">Period Start</label>
                    <input type="date" class="form-input" id="sal-start">
                </div>
                <div class="form-group">
                    <label class="form-label">Period End</label>
                    <input type="date" class="form-input" id="sal-end">
                </div>
                <div class="form-group">
                    <label class="form-label">Payment Method</label>
                    <select class="form-select" id="sal-method">
                        <option value="cash">Cash</option>
                        <option value="mpesa">M-Pesa</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Notes</label>
                    <input type="text" class="form-input" id="sal-notes" placeholder="Optional">
                </div>`;

            showFormModal('Pay Salary', formHtml, async (overlay) => {
                const data = {
                    staff_id: staffId,
                    apartment_id: aptId,
                    amount_paid: parseFloat(overlay.querySelector('#sal-amount').value),
                    payment_date: overlay.querySelector('#sal-date').value,
                    period_start: overlay.querySelector('#sal-start').value,
                    period_end: overlay.querySelector('#sal-end').value,
                    payment_method: overlay.querySelector('#sal-method').value,
                    notes: overlay.querySelector('#sal-notes').value
                };

                if (!data.amount_paid || !data.payment_date || !data.period_start || !data.period_end) {
                    showToast('Please fill all required fields', 'error');
                    return false;
                }
                try {
                    await apiService.post('/staff/salaries', data);
                    showToast('Salary recorded successfully', 'success');
                } catch (e) {
                    showToast(e.message, 'error');
                    return false;
                }
            });
        });
    }
}
