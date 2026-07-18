import { apiService } from '../../services/api.service.js';
import { formatDate, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';
import { authService } from '../../services/auth.service.js';

export default async function tenantMaintenance(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">My Maintenance Requests</h3>
                <button class="btn btn-primary" id="new-request-btn">
                    <i class="fas fa-plus"></i> New Request
                </button>
            </div>
            <div id="my-requests" class="table-container">
                <div class="page-loader"><div class="spinner"></div></div>
            </div>
        </div>`;

    document.getElementById('new-request-btn').addEventListener('click', openNewRequest);
    await loadMyRequests();

    async function loadMyRequests() {
        try {
            const response = await apiService.get('/maintenance/my-requests');
            const requests = response.success ? response.data : [];
            const table = document.getElementById('my-requests');

            if (requests.length === 0) {
                table.innerHTML = `<div class="empty-state"><i class="fas fa-tools"></i><h3>No requests</h3><p>Submit a maintenance request when needed.</p></div>`;
                return;
            }

            table.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Unit</th>
                            <th>Status</th>
                            <th>Assigned To</th>
                            <th>Reported</th>
                            <th>Resolved</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => `
                            <tr>
                                <td>${r.title}</td>
                                <td>${r.units?.unit_number || 'N/A'}</td>
                                <td><span class="badge badge-${r.status==='resolved'?'success':r.status==='in_progress'?'info':'warning'}">${r.status}</span></td>
                                <td>${r.assigned_to || '-'}</td>
                                <td>${formatDate(r.date_reported)}</td>
                                <td>${r.date_resolved ? formatDate(r.date_resolved) : '-'}</td>
                                <td>
                                    <button class="btn btn-sm btn-outline view-btn" data-id="${r.id}">
                                        <i class="fas fa-eye"></i> View
                                    </button>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>`;

            // Event delegation for view button
            table.addEventListener('click', (e) => {
                const viewBtn = e.target.closest('.view-btn');
                if (viewBtn) {
                    openViewModal(viewBtn.dataset.id);
                }
            });

        } catch (e) {
            document.getElementById('my-requests').innerHTML = `<div class="error-state"><p>${e.message}</p></div>`;
        }
    }

    async function openViewModal(requestId) {
        try {
            const res = await apiService.get(`/maintenance/${requestId}`);
            if (!res.success) throw new Error('Request not found');
            const r = res.data;

            // Build comments HTML
            let commentsHtml = '';
            if (r.comments && r.comments.length > 0) {
                commentsHtml = r.comments.map(c => `
                    <div style="margin-bottom:8px; padding:8px; background:var(--bg-input); border-radius:6px;">
                        <strong>${c.user?.full_name || 'Unknown'} (${c.user?.role})</strong>
                        <p style="margin:4px 0;">${c.comment}</p>
                        <small class="text-muted">${formatDate(c.created_at)}</small>
                    </div>
                `).join('');
            } else {
                commentsHtml = '<p class="text-muted">No comments yet.</p>';
            }

            const { showFormModal } = await import('../../components/modal.js');
            const formHtml = `
                <p><strong>Title:</strong> ${r.title}</p>
                <p><strong>Description:</strong> ${r.description || 'N/A'}</p>
                <p><strong>Priority:</strong> ${capitalize(r.priority)}</p>
                <p><strong>Status:</strong> ${capitalize(r.status)}</p>
                <p><strong>Assigned To:</strong> ${r.assigned_to || 'Not assigned'}</p>
                <p><strong>Cost Incurred:</strong> ${r.cost_incurred || 0}</p>
                <hr>
                <div class="form-group">
                    <label class="form-label">Add Comment</label>
                    <textarea class="form-textarea" id="tenant-comment" rows="2" placeholder="Write a comment..."></textarea>
                </div>
                <div class="mt-2">
                    <h4 style="font-size:0.9rem;">Comments</h4>
                    <div id="comments-list">${commentsHtml}</div>
                </div>`;

            showFormModal('Request Details', formHtml, async (overlay) => {
                const comment = overlay.querySelector('#tenant-comment').value.trim();
                if (comment) {
                    try {
                        await apiService.post(`/maintenance/${requestId}/comments`, { comment });
                        showToast('Comment added', 'success');
                        loadMyRequests(); // refresh list
                    } catch (e) {
                        showToast(e.message, 'error');
                        return false;
                    }
                }
            });

        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    async function openNewRequest() {
        const dashResponse = await apiService.get('/dashboard/tenant');
        if (!dashResponse.success || !dashResponse.data.tenant) {
            showToast('No active tenancy found', 'error');
            return;
        }
        const tenant = dashResponse.data.tenant;
        const { showFormModal } = await import('../../components/modal.js');
        const form = `
            <p>Unit: <strong>${tenant.unit_number}</strong></p>
            <div class="form-group"><label class="form-label">Title</label><input class="form-input" id="req-title"></div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" id="req-desc"></textarea></div>
            <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="req-priority"><option>low</option><option selected>medium</option><option>high</option><option>urgent</option></select></div>`;
        showFormModal('New Maintenance Request', form, async (overlay) => {
            const data = {
                unit_id: tenant.unit_id,
                apartment_id: tenant.apartment_id,
                title: overlay.querySelector('#req-title').value,
                description: overlay.querySelector('#req-desc').value,
                priority: overlay.querySelector('#req-priority').value
            };
            if (!data.title) { showToast('Title required', 'error'); return false; }
            try {
                await apiService.post('/maintenance', data);
                showToast('Request submitted', 'success');
                loadMyRequests();
            } catch (e) { showToast(e.message, 'error'); return false; }
        });
    }
}
