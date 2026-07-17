import { apiService } from '../../services/api.service.js';
import { formatDate, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';
import { authService } from '../../services/auth.service.js';

export default async function tenantMaintenance(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header"><h3 class="card-title">My Maintenance Requests</h3><button class="btn btn-primary" id="new-request-btn"><i class="fas fa-plus"></i> New Request</button></div>
            <div id="my-requests" class="table-container"><div class="page-loader"><div class="spinner"></div></div></div>
        </div>`;
    document.getElementById('new-request-btn').addEventListener('click', openNewRequest);
    await loadMyRequests();
}

async function loadMyRequests() {
    try {
        const response = await apiService.get('/maintenance/my-requests');
        const requests = response.success ? response.data : [];
        const table = document.getElementById('my-requests');
        if (requests.length === 0) {
            table.innerHTML = `<div class="empty-state"><i class="fas fa-tools"></i><h3>No requests</h3><p>Submit a maintenance request when needed.</p></div>`;
            return;
        }
        table.innerHTML = `<table class="table"><thead><tr><th>Title</th><th>Unit</th><th>Status</th><th>Reported</th><th>Resolved</th></tr></thead><tbody>${requests.map(r => `
            <tr><td>${r.title}</td><td>${r.units?.unit_number || 'N/A'}</td><td><span class="badge badge-${r.status==='resolved'?'success':r.status==='in_progress'?'info':'warning'}">${r.status}</span></td><td>${formatDate(r.date_reported)}</td><td>${r.date_resolved ? formatDate(r.date_resolved) : '-'}</td></tr>`).join('')}</tbody></table>`;
    } catch (e) {
        document.getElementById('my-requests').innerHTML = `<div class="error-state"><p>${e.message}</p></div>`;
    }
}

async function openNewRequest() {
    // Get tenant's unit info
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
