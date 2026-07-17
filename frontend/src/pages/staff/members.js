import { apiService } from '../../services/api.service.js';
import { formatCurrency, formatDate, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';

export default async function staffMembers(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Staff Members</h3>
                <button class="btn btn-primary" id="add-member-btn">
                    <i class="fas fa-plus"></i> Add Member
                </button>
            </div>
            <div class="filter-bar">
                <select class="form-select" id="filter-apt">
                    <option value="">All Apartments</option>
                </select>
                <select class="form-select" id="filter-role">
                    <option value="">All Roles</option>
                </select>
            </div>
            <div id="members-table" class="table-container">
                <div class="page-loader"><div class="spinner"></div></div>
            </div>
        </div>`;

    const [aptRes, rolesRes] = await Promise.all([
        apiService.get('/apartments'),
        apiService.get('/staff/roles')
    ]);

    if (aptRes.success) {
        aptRes.data.forEach(a => {
            document.getElementById('filter-apt').innerHTML += 
                `<option value="${a.id}">${a.name}</option>`;
        });
    }
    if (rolesRes.success) {
        rolesRes.data.forEach(r => {
            document.getElementById('filter-role').innerHTML += 
                `<option value="${r.id}">${r.role_name}</option>`;
        });
    }

    document.getElementById('filter-apt').addEventListener('change', loadMembers);
    document.getElementById('filter-role').addEventListener('change', loadMembers);
    document.getElementById('add-member-btn').addEventListener('click', openAddModal);

    await loadMembers();
}

async function loadMembers() {
    const aptId = document.getElementById('filter-apt').value;
    const roleId = document.getElementById('filter-role').value;

    if (!aptId) {
        document.getElementById('members-table').innerHTML = 
            `<p class="text-center p-3">Select an apartment to view staff.</p>`;
        return;
    }

    let query = `apartment/${aptId}`;
    if (roleId) query += `?role_id=${roleId}`;

    try {
        const response = await apiService.get(`/staff/members/${query}`);
        const members = response.success ? response.data : [];
        const table = document.getElementById('members-table');

        if (members.length === 0) {
            table.innerHTML = `<div class="empty-state"><h3>No staff members</h3></div>`;
            return;
        }

        table.innerHTML = `
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
                                    <button onclick="editStaffMember('${m.id}')" title="Edit">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="paySalary('${m.id}','${m.full_name}','${aptId}')" title="Pay Salary">
                                        <i class="fas fa-money-bill"></i>
                                    </button>
                                    <button onclick="createCaretakerAccount('${m.id}','${m.full_name}','${m.phone}')" 
                                            title="Create Caretaker Account">
                                        <i class="fas fa-user-plus"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;

        // Expose functions globally
        window.editStaffMember = editStaffMember;
        window.paySalary = paySalary;
        window.createCaretakerAccount = createCaretakerAccount;

    } catch (e) {
        document.getElementById('members-table').innerHTML = 
            `<div class="error-state"><p>${e.message}</p></div>`;
    }
}

async function openAddModal() {
    const { showFormModal } = await import('../../components/modal.js');
    const [aptRes, rolesRes] = await Promise.all([
        apiService.get('/apartments'),
        apiService.get('/staff/roles')
    ]);

    const formHtml = `
        <div class="form-group">
            <label class="form-label">Apartment</label>
            <select class="form-select" id="mem-apt">
                ${aptRes.data?.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="mem-role">
                ${rolesRes.data?.map(r => `<option value="${r.id}">${r.role_name}</option>`).join('')}
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
            <input type="date" class="form-input" id="mem-date" 
                   value="${new Date().toISOString().split('T')[0]}">
        </div>`;

    showFormModal('Add Staff Member', formHtml, async (overlay) => {
        const data = {
            apartment_id: overlay.querySelector('#mem-apt').value,
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

async function editStaffMember(memberId) {
    // Fetch current member data
    const response = await apiService.get(`/staff/members/${memberId}`);
    if (!response.success) {
        showToast('Could not fetch member details', 'error');
        return;
    }
    const member = response.data;

    // Fetch roles for dropdown
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
                ${roles.map(r => 
                    `<option value="${r.id}" ${member.staff_role_id === r.id ? 'selected' : ''}>
                        ${r.role_name}
                    </option>`
                ).join('')}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Monthly Salary (KES)</label>
            <input type="number" class="form-input" id="edit-salary" 
                   value="${member.monthly_salary}" step="100" min="0">
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
            return false; // keep modal open
        }
    });
}

async function createCaretakerAccount(staffId, name, phone) {
    const { showFormModal } = await import('../../components/modal.js');
    const defaultPassword = phone.replace(/\D/g, '').slice(-6) || '123456';
    
    const formHtml = `
        <p>Create a caretaker login account for <strong>${name}</strong>.</p>
        <p>Phone: <strong>${phone}</strong></p>
        <div class="form-group">
            <label class="form-label">Password</label>
            <input type="text" class="form-input" id="caretaker-password" value="${defaultPassword}" readonly>
            <small class="text-muted">
                Default password is the last 6 digits of the phone number. 
                The caretaker should change it after first login.
            </small>
        </div>`;

    showFormModal('Create Caretaker Account', formHtml, async (overlay) => {
        const password = overlay.querySelector('#caretaker-password').value;
        try {
            await apiService.post('/auth/register', {
                full_name: name,
                phone: phone,
                password: password,
                role: 'caretaker'
            });
            showToast(`Caretaker account created! Password: ${password}`, 'success');
        } catch (e) {
            // If user already exists, show a helpful message
            if (e.message.includes('already exists')) {
                showToast('A user with this phone number already exists. Use a different phone or delete the existing user.', 'error');
            } else {
                showToast(e.message, 'error');
            }
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
                <input type="date" class="form-input" id="sal-date" 
                       value="${new Date().toISOString().split('T')[0]}">
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
