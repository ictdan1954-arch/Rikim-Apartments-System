import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { formatDate, formatCurrency, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';
import { router } from '../../router.js';
import { openChatModal } from '../../components/chat.js';

export default async function apartmentDetails(container, params) {
    const id = params.id;
    container.innerHTML = `<div class="page-loader"><div class="spinner"></div></div>`;

    try {
        const response = await apiService.get(`/apartments/${id}`);
        if (!response.success) throw new Error('Apartment not found');
        const a = response.data;
        const userRole = authService.getRole();

        container.innerHTML = `
            <div class="mb-2">
                <button class="btn btn-outline btn-sm" onclick="window.router.navigate('/apartments')">
                    <i class="fas fa-arrow-left"></i> Back to Apartments
                </button>
            </div>
            <div class="card mb-2">
                <div class="card-header">
                    <div>
                        <h2 style="font-size:1.5rem;">${a.name}</h2>
                        <p class="text-muted">${a.location}</p>
                    </div>
                    <span class="badge badge-${a.status === 'active' ? 'success' : 'secondary'}">${a.status}</span>
                </div>
                <p>${a.description || 'No description'}</p>
                <div class="dashboard-stats mt-2" style="grid-template-columns: repeat(3,1fr);">
                    <div class="stat-card">
                        <div class="stat-icon primary"><i class="fas fa-door-open"></i></div>
                        <div class="stat-info">
                            <div class="stat-value">${a.unit_count}</div>
                            <div class="stat-label">Total Units</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon success"><i class="fas fa-users"></i></div>
                        <div class="stat-info">
                            <div class="stat-value">${a.tenant_count}</div>
                            <div class="stat-label">Active Tenants</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon info"><i class="fas fa-calendar"></i></div>
                        <div class="stat-info">
                            <div class="stat-value" style="font-size:1rem;">${formatDate(a.created_at)}</div>
                            <div class="stat-label">Date Created</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom: 24px;">
                <button class="btn btn-primary" onclick="window.router.navigate('/units/${a.id}')">
                    <i class="fas fa-door-open"></i> View Units
                </button>
                <button class="btn btn-outline" onclick="window.router.navigate('/payments/rent?apartment=${a.id}')">
                    <i class="fas fa-money-bill-wave"></i> Rent Payments
                </button>
                <button class="btn btn-outline" onclick="window.router.navigate('/expenses?apartment=${a.id}')">
                    <i class="fas fa-receipt"></i> Expenses
                </button>
            </div>

            <!-- ========== UNITS BY TYPE BREAKDOWN (NEW) ========== -->
            ${a.units_breakdown && a.units_breakdown.length > 0 ? `
            <div class="card mb-2">
                <div class="card-header"><h3 class="card-title">Units by Type</h3></div>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    ${a.units_breakdown.map(b => {
                        const occupancyPercent = b.total ? Math.round((b.occupied / b.total) * 100) : 0;
                        const barColor = occupancyPercent >= 80 ? 'var(--secondary)' : occupancyPercent >= 40 ? 'var(--warning)' : 'var(--danger)';
                        return `
                        <div class="stat-card" style="flex-direction:column; align-items:flex-start; min-width:180px;">
                            <div class="stat-label" style="font-weight:700;">${capitalize(b.unit_type)}</div>
                            <div style="display:flex; justify-content:space-between; width:100%; margin-top:4px;">
                                <span>${b.occupied}/${b.total} occupied</span>
                                <span>${b.vacant} vacant</span>
                            </div>
                            <div style="width:100%; background:var(--border); height:6px; border-radius:3px; margin-top:4px;">
                                <div style="width:${occupancyPercent}%; background:${barColor}; height:100%; border-radius:3px;"></div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : ''}
            <!-- =================================================== -->

            <!-- Caretaker Management (Landlord only) -->
            ${userRole === 'landlord' ? `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Caretakers</h3>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-primary btn-sm" id="assign-caretaker-btn">
                            <i class="fas fa-user-plus"></i> Assign Caretaker
                        </button>
                        <button class="btn btn-outline btn-sm" id="msg-all-caretakers-btn">
                            <i class="fas fa-envelope"></i> Message All
                        </button>
                    </div>
                </div>
                <div id="caretakers-list" class="table-container">
                    <div class="page-loader"><div class="spinner"></div></div>
                </div>
            </div>` : ''}
        `;

        if (userRole === 'landlord') {
            loadCaretakers(id);
            document.getElementById('assign-caretaker-btn').addEventListener('click', () => openAssignCaretaker(id));
            document.getElementById('msg-all-caretakers-btn').addEventListener('click', () => broadcastToAllCaretakers(id));
        }
    } catch (error) {
        container.innerHTML = `<div class="error-state"><h2>Error</h2><p>${error.message}</p></div>`;
    }
}

// =============================================
// CARETAKER FUNCTIONS (unchanged)
// =============================================
async function loadCaretakers(apartmentId) {
    try {
        const res = await apiService.get(`/apartments/${apartmentId}/caretakers`);
        if (!res.success) throw new Error('Failed to load caretakers');

        const caretakers = res.data;
        const container = document.getElementById('caretakers-list');

        if (!caretakers || caretakers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-tie"></i>
                    <p>No caretakers assigned to this apartment yet.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Assigned Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${caretakers.map(c => `
                        <tr>
                            <td>${c.users?.full_name || 'N/A'}</td>
                            <td>${c.users?.username || '-'}</td>
                            <td>${c.users?.phone || 'N/A'}</td>
                            <td>${c.users?.email || '-'}</td>
                            <td>${formatDate(c.assigned_at)}</td>
                            <td>
                                <div class="table-actions">
                                    <button class="edit-caretaker-btn" 
                                            data-user-id="${c.users?.id}" 
                                            data-full-name="${c.users?.full_name}" 
                                            data-username="${c.users?.username || ''}" 
                                            title="Edit Account">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="msg-caretaker-btn"
                                            data-user-id="${c.users?.id}"
                                            data-full-name="${c.users?.full_name}"
                                            title="Message">
                                        <i class="fas fa-envelope"></i>
                                    </button>
                                    <button class="danger remove-caretaker-btn" 
                                            data-assignment-id="${c.id}" 
                                            title="Remove">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;

        // Event delegation
        container.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-caretaker-btn');
            if (editBtn) {
                const userId = editBtn.dataset.userId;
                const fullName = editBtn.dataset.fullName;
                const username = editBtn.dataset.username;
                editCaretakerAccount(userId, fullName, username, apartmentId);
                return;
            }

            const msgBtn = e.target.closest('.msg-caretaker-btn');
            if (msgBtn) {
                const userId = msgBtn.dataset.userId;
                const fullName = msgBtn.dataset.fullName;
                openChatModal(authService.user?.id, userId, fullName, apartmentId);
                return;
            }

            const removeBtn = e.target.closest('.remove-caretaker-btn');
            if (removeBtn) {
                const assignmentId = removeBtn.dataset.assignmentId;
                removeCaretakerHandler(assignmentId, apartmentId);
                return;
            }
        });

    } catch (error) {
        document.getElementById('caretakers-list').innerHTML = `
            <div class="error-state"><p>${error.message}</p></div>`;
    }
}

async function broadcastToAllCaretakers(apartmentId) {
    const { showFormModal } = await import('../../components/modal.js');
    const formHtml = `
        <div class="form-group">
            <label class="form-label">Message</label>
            <textarea class="form-textarea" id="broadcast-msg" rows="4" placeholder="Type your message to all caretakers of this apartment..."></textarea>
        </div>`;
    showFormModal('Message All Caretakers', formHtml, async (overlay) => {
        const message = overlay.querySelector('#broadcast-msg').value.trim();
        if (!message) {
            showToast('Message is required', 'error');
            return false;
        }
        try {
            const res = await apiService.post('/messages/broadcast', {
                role: 'caretaker',
                apartment_id: apartmentId,
                message
            });
            showToast(res.message || 'Broadcast sent!', 'success');
        } catch (e) {
            showToast(e.message, 'error');
            return false;
        }
    });
}

async function openAssignCaretaker(apartmentId) {
    const usersRes = await apiService.get('/auth/users?role=caretaker');
    if (!usersRes.success) {
        showToast('Failed to load caretakers', 'error');
        return;
    }

    const caretakers = usersRes.data;
    if (caretakers.length === 0) {
        showToast('No caretaker accounts exist. Create one from Staff Members first.', 'warning');
        return;
    }

    const formHtml = `
        <div class="form-group">
            <label class="form-label">Select Caretaker</label>
            <select class="form-select" id="caretaker-select">
                ${caretakers.map(u => `<option value="${u.id}">${u.full_name} (${u.username || u.phone})</option>`).join('')}
            </select>
        </div>`;

    const { showFormModal } = await import('../../components/modal.js');
    showFormModal('Assign Caretaker', formHtml, async (overlay) => {
        const userId = overlay.querySelector('#caretaker-select').value;
        try {
            await apiService.post(`/apartments/${apartmentId}/caretakers`, { user_id: userId });
            showToast('Caretaker assigned successfully', 'success');
            loadCaretakers(apartmentId);
        } catch (e) {
            showToast(e.message, 'error');
            return false;
        }
    });
}

async function editCaretakerAccount(userId, currentName, currentUsername, apartmentId) {
    const { showFormModal } = await import('../../components/modal.js');
    const formHtml = `
        <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" class="form-input" id="edit-user-username" value="${currentUsername}" placeholder="Enter username">
        </div>
        <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" class="form-input" id="edit-user-name" value="${currentName}">
        </div>
        <div class="form-group">
            <label class="form-label">New Password (leave blank to keep current)</label>
            <div style="position: relative;">
                <input type="password" class="form-input" id="edit-user-password" placeholder="Min 6 characters" style="padding-right: 40px;">
                <button type="button" class="password-toggle" 
                        style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px 8px;"
                        onclick="const pwd = document.getElementById('edit-user-password'); 
                                 if(pwd.type === 'password') { pwd.type = 'text'; this.innerHTML = '<i class=\\'fas fa-eye-slash\\'></i>'; } 
                                 else { pwd.type = 'password'; this.innerHTML = '<i class=\\'fas fa-eye\\'></i>'; }">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </div>
        <p class="text-muted">Leave password empty if you only want to change the name/username.</p>`;

    showFormModal('Edit Caretaker Account', formHtml, async (overlay) => {
        const username = overlay.querySelector('#edit-user-username').value.trim();
        const full_name = overlay.querySelector('#edit-user-name').value.trim();
        const password = overlay.querySelector('#edit-user-password').value.trim();

        if (!full_name) {
            showToast('Name is required', 'error');
            return false;
        }

        const body = { full_name };
        if (username) body.username = username;
        if (password) {
            if (password.length < 6) {
                showToast('Password must be at least 6 characters', 'error');
                return false;
            }
            body.password = password;
        }

        try {
            await apiService.put(`/auth/users/${userId}`, body);
            showToast('Caretaker account updated!', 'success');
            loadCaretakers(apartmentId);
        } catch (e) {
            showToast(e.message, 'error');
            return false;
        }
    });
}

async function removeCaretakerHandler(assignmentId, apartmentId) {
    const { showConfirm } = await import('../../components/modal.js');
    showConfirm('Remove Caretaker', 'Are you sure you want to remove this caretaker from the apartment?', async () => {
        try {
            await apiService.delete(`/apartments/caretakers/${assignmentId}`);
            showToast('Caretaker removed', 'success');
            loadCaretakers(apartmentId);
        } catch (e) {
            showToast(e.message, 'error');
        }
    });
}
