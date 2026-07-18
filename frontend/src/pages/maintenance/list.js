import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { formatDate, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';
import { CONFIG } from '../../config/constants.js';

export default async function maintenanceList(container) {
    const role = authService.getRole();
    let apartments = [];
    let defaultAptId = null;
    let defaultAptName = '';

    if (role === 'caretaker') {
        const aptRes = await apiService.get('/apartments');
        if (aptRes.success && aptRes.data.length > 0) {
            apartments = aptRes.data;
            defaultAptId = apartments[0].id;
            defaultAptName = apartments[0].name;
        }
    } else {
        const aptRes = await apiService.get('/apartments');
        apartments = aptRes.success ? aptRes.data : [];
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Maintenance Requests${defaultAptName ? ` – ${defaultAptName}` : ''}</h3>
                <button class="btn btn-primary" id="add-request-btn">
                    <i class="fas fa-plus"></i> New Request
                </button>
            </div>
            <div class="filter-bar">
                ${role === 'landlord' ? `
                <div class="form-group">
                    <select class="form-select" id="filter-apt">
                        <option value="">Select Apartment</option>
                        ${apartments.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                    </select>
                </div>` : `
                <div class="form-group">
                    <input type="hidden" id="filter-apt" value="${defaultAptId}">
                    <p class="text-muted" style="margin:0; padding-top:8px;">
                        Showing requests for <strong>${defaultAptName}</strong>
                    </p>
                </div>`}
                <div class="form-group">
                    <select class="form-select" id="filter-status">
                        <option value="">All Status</option>
                        ${CONFIG.MAINTENANCE_STATUSES.map(s => `<option value="${s}">${capitalize(s)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <select class="form-select" id="filter-priority">
                        <option value="">All Priority</option>
                        ${CONFIG.PRIORITIES.map(p => `<option value="${p}">${capitalize(p)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <input type="date" class="form-input" id="filter-start" placeholder="From date">
                </div>
                <div class="form-group">
                    <input type="date" class="form-input" id="filter-end" placeholder="To date">
                </div>
            </div>
            <div id="maintenance-summary" class="mt-2" style="display:none;"></div>
            <div id="maintenance-table" class="table-container">
                <div class="page-loader"><div class="spinner"></div></div>
            </div>
        </div>`;

    const aptSelect = container.querySelector('#filter-apt');
    const statusSelect = container.querySelector('#filter-status');
    const prioritySelect = container.querySelector('#filter-priority');
    const startInput = container.querySelector('#filter-start');
    const endInput = container.querySelector('#filter-end');
    const addBtn = container.querySelector('#add-request-btn');
    const tableContainer = container.querySelector('#maintenance-table');
    const summaryContainer = container.querySelector('#maintenance-summary');

    if (role === 'landlord') {
        aptSelect.addEventListener('change', loadRequests);
    }
    statusSelect.addEventListener('change', loadRequests);
    prioritySelect.addEventListener('change', loadRequests);
    startInput.addEventListener('change', loadRequests);
    endInput.addEventListener('change', loadRequests);
    addBtn.addEventListener('click', openCreateRequestModal);

    loadRequests();

    async function loadRequests() {
        const apartmentId = aptSelect.value || defaultAptId;
        if (!apartmentId) {
            tableContainer.innerHTML = `<p class="text-center p-3">${role === 'caretaker' ? 'No apartment assigned.' : 'Select an apartment to view requests.'}</p>`;
            summaryContainer.style.display = 'none';
            return;
        }

        const status = statusSelect.value;
        const priority = prioritySelect.value;
        const start = startInput.value;
        const end = endInput.value;

        let query = '';
        if (status) query += `status=${status}&`;
        if (priority) query += `priority=${priority}&`;
        if (start) query += `start_date=${start}&`;
        if (end) query += `end_date=${end}&`;

        const endpoint = `/maintenance/apartment/${apartmentId}?${query}`;

        try {
            const response = await apiService.get(endpoint);
            const requests = response.success ? response.data : [];

            // Summary
            if (requests.length > 0) {
                const now = new Date();
                const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
                const reported = requests.filter(r => r.status === 'reported').length;
                const inProgress = requests.filter(r => r.status === 'in_progress').length;
                const resolvedThisMonth = requests.filter(r => r.status === 'resolved' && r.date_resolved >= firstOfMonth).length;

                summaryContainer.innerHTML = `
                    <div style="display:flex; gap:12px; flex-wrap:wrap;">
                        <div class="stat-card">
                            <div class="stat-icon warning"><i class="fas fa-exclamation-circle"></i></div>
                            <div class="stat-info">
                                <div class="stat-label">Open (Reported)</div>
                                <div class="stat-value">${reported}</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon info"><i class="fas fa-spinner"></i></div>
                            <div class="stat-info">
                                <div class="stat-label">In Progress</div>
                                <div class="stat-value">${inProgress}</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon success"><i class="fas fa-check-circle"></i></div>
                            <div class="stat-info">
                                <div class="stat-label">Resolved This Month</div>
                                <div class="stat-value">${resolvedThisMonth}</div>
                            </div>
                        </div>
                    </div>
                `;
                summaryContainer.style.display = 'block';
            } else {
                summaryContainer.style.display = 'none';
            }

            if (requests.length === 0) {
                tableContainer.innerHTML = `<div class="empty-state"><i class="fas fa-tools"></i><h3>No requests</h3></div>`;
                return;
            }

            // Can escalate? (caretaker only, not escalated, older than 2 days)
            const canEscalate = (r) => {
                if (role !== 'caretaker') return false;
                if (r.escalated) return false;
                const reportedDate = new Date(r.date_reported);
                const now = new Date();
                const diffDays = (now - reportedDate) / (1000 * 60 * 60 * 24);
                return diffDays >= 2 && r.status === 'reported';
            };

            tableContainer.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Title</th><th>Unit</th><th>Priority</th><th>Status</th><th>Reported</th><th>Assigned To</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => `
                            <tr>
                                <td>${r.title}</td>
                                <td>${r.units?.unit_number || 'N/A'}</td>
                                <td><span class="badge badge-${r.priority === 'high' || r.priority === 'urgent' ? 'danger' : 'warning'}">${r.priority}</span></td>
                                <td><span class="badge badge-${r.status === 'resolved' ? 'success' : r.status === 'in_progress' ? 'info' : 'warning'}">${r.status}</span></td>
                                <td>${formatDate(r.date_reported)}</td>
                                <td>${r.assigned_to || '-'}</td>
                                <td>
                                    <div class="table-actions">
                                        <button class="btn btn-sm btn-outline update-btn" data-id="${r.id}" data-status="${r.status}" data-assigned="${r.assigned_to || ''}" data-cost="${r.cost_incurred || 0}">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        ${canEscalate(r) ? `
                                        <button class="btn btn-sm btn-outline escalate-btn" data-id="${r.id}" title="Escalate to landlord">
                                            <i class="fas fa-arrow-up"></i>
                                        </button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;

            // Event delegation for update and escalate buttons
            tableContainer.addEventListener('click', (e) => {
                const updateBtn = e.target.closest('.update-btn');
                if (updateBtn) {
                    const id = updateBtn.dataset.id;
                    const currentStatus = updateBtn.dataset.status;
                    const assignedTo = updateBtn.dataset.assigned;
                    const cost = updateBtn.dataset.cost;
                    openUpdateModal(id, currentStatus, assignedTo, cost);
                    return;
                }
                const escalateBtn = e.target.closest('.escalate-btn');
                if (escalateBtn) {
                    const id = escalateBtn.dataset.id;
                    escalateRequest(id);
                    return;
                }
            });

        } catch (e) {
            tableContainer.innerHTML = `<div class="error-state"><p>${e.message}</p></div>`;
            summaryContainer.style.display = 'none';
        }
    }

    // Create request modal (for caretaker/landlord)
    async function openCreateRequestModal() {
        const apartmentId = aptSelect.value || defaultAptId;
        if (!apartmentId) {
            showToast('Please select an apartment first', 'warning');
            return;
        }

        const unitsRes = await apiService.get(`/units/apartment/${apartmentId}`);
        const units = unitsRes.success ? unitsRes.data : [];

        const { showFormModal } = await import('../../components/modal.js');
        const formHtml = `
            <div class="form-group">
                <label class="form-label">Unit</label>
                <select class="form-select" id="req-unit">
                    ${units.map(u => `<option value="${u.id}">${u.unit_number}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Title <span class="required">*</span></label>
                <input class="form-input" id="req-title" required>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="req-desc" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Priority</label>
                <select class="form-select" id="req-priority">
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                </select>
            </div>`;

        showFormModal('New Maintenance Request', formHtml, async (overlay) => {
            const data = {
                unit_id: overlay.querySelector('#req-unit').value,
                apartment_id: apartmentId,
                title: overlay.querySelector('#req-title').value.trim(),
                description: overlay.querySelector('#req-desc').value.trim(),
                priority: overlay.querySelector('#req-priority').value
            };
            if (!data.title) {
                showToast('Title is required', 'error');
                return false;
            }
            try {
                await apiService.post('/maintenance', data);
                showToast('Request created', 'success');
                loadRequests();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        });
    }

    // Escalate request
    async function escalateRequest(requestId) {
        const { showConfirm } = await import('../../components/modal.js');
        showConfirm('Escalate Request', 'Notify the landlord about this request?', async () => {
            try {
                await apiService.put(`/maintenance/${requestId}/escalate`);
                showToast('Request escalated to landlord', 'success');
                loadRequests();
            } catch (e) {
                showToast(e.message, 'error');
            }
        });
    }

    // Update modal with comments
    async function openUpdateModal(requestId, currentStatus, assignedTo, cost) {
        // Fetch existing comments
        let commentsHtml = '<p>Loading comments...</p>';
        try {
            const commentsRes = await apiService.get(`/maintenance/${requestId}/comments`);
            if (commentsRes.success && commentsRes.data.length > 0) {
                commentsHtml = commentsRes.data.map(c => `
                    <div style="margin-bottom:8px; padding:8px; background:var(--bg-input); border-radius:6px;">
                        <strong>${c.user?.full_name || 'Unknown'} (${c.user?.role})</strong>
                        <p style="margin:4px 0;">${c.comment}</p>
                        <small class="text-muted">${formatDate(c.created_at)}</small>
                    </div>
                `).join('');
            } else {
                commentsHtml = '<p class="text-muted">No comments yet.</p>';
            }
        } catch (e) {
            commentsHtml = '<p class="text-muted">Could not load comments.</p>';
        }

        const { showFormModal } = await import('../../components/modal.js');
        const formHtml = `
            <div class="form-group">
                <label class="form-label">Status</label>
                <select class="form-select" id="m-status-update">
                    ${CONFIG.MAINTENANCE_STATUSES.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${capitalize(s)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Assigned To</label>
                <input class="form-input" id="m-assign" value="${assignedTo}" placeholder="Worker name">
            </div>
            <div class="form-group">
                <label class="form-label">Cost Incurred (KES)</label>
                <input type="number" class="form-input" id="m-cost" min="0" step="100" value="${cost}">
            </div>
            <div class="form-group">
                <label class="form-label">Add Comment</label>
                <textarea class="form-textarea" id="m-comment" rows="2" placeholder="Optional comment..."></textarea>
            </div>
            <div class="mt-3">
                <h4 style="font-size:0.9rem; margin-bottom:8px;">Comments</h4>
                <div id="comments-list">${commentsHtml}</div>
            </div>`;

        showFormModal('Update Request', formHtml, async (overlay) => {
            const updates = {
                status: overlay.querySelector('#m-status-update').value,
                assigned_to: overlay.querySelector('#m-assign').value.trim(),
                cost_incurred: parseFloat(overlay.querySelector('#m-cost').value) || 0
            };
            const commentText = overlay.querySelector('#m-comment').value.trim();

            try {
                // Update request
                await apiService.put(`/maintenance/${requestId}`, updates);

                // Add comment if provided
                if (commentText) {
                    await apiService.post(`/maintenance/${requestId}/comments`, { comment: commentText });
                }

                showToast('Request updated', 'success');
                loadRequests();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        });
    }
}
