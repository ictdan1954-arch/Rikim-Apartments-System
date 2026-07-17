import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { Modal, showFormModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { formatCurrency, formatDate, capitalize } from '../../utils/formatters.js';
import { CONFIG } from '../../config/constants.js';

export default async function unitsList(container, params) {
    let apartmentId = params.apartmentId;
    // If "all", let user pick or show all (we'll do simple approach: fetch apartments first)
    container.innerHTML = `<div class="page-loader"><div class="spinner"></div></div>`;

    if (apartmentId === 'all') {
        // Show apartment selector
        const aptResponse = await apiService.get('/apartments');
        if (!aptResponse.success) return;
        const apartments = aptResponse.data;
        if (apartments.length === 0) {
            container.innerHTML = `<div class="empty-state"><h3>No apartments</h3></div>`;
            return;
        }
        apartmentId = apartments[0].id; // Default first
        renderPage(container, apartmentId, apartments);
    } else {
        renderPage(container, apartmentId);
    }
}

async function renderPage(container, apartmentId, apartments = null) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Units</h3>
                <div style="display:flex; gap:12px; align-items:center;">
                    ${apartments ? `
                    <select class="form-select" id="apartment-select" style="width:auto;">
                        ${apartments.map(a => `<option value="${a.id}" ${a.id === apartmentId ? 'selected' : ''}>${a.name}</option>`).join('')}
                    </select>` : ''}
                    <button class="btn btn-primary" id="add-unit-btn"><i class="fas fa-plus"></i> Add Unit</button>
                </div>
            </div>
            <div id="units-table" class="table-container">
                <div class="page-loader"><div class="spinner"></div></div>
            </div>
        </div>`;

    if (apartments) {
        document.getElementById('apartment-select').addEventListener('change', (e) => {
            window.router.navigate(`/units/${e.target.value}`);
        });
    }

    document.getElementById('add-unit-btn').addEventListener('click', () => openAddModal(apartmentId));
    await loadUnits(apartmentId);
}

async function loadUnits(apartmentId) {
    try {
        const response = await apiService.get(`/units/apartment/${apartmentId}`);
        if (!response.success) throw new Error(response.message);
        const units = response.data;
        const table = document.getElementById('units-table');

        if (units.length === 0) {
            table.innerHTML = `<div class="empty-state"><i class="fas fa-door-closed"></i><h3>No Units</h3></div>`;
            return;
        }

        table.innerHTML = `
            <table class="table">
                <thead>
                    <tr><th>Unit</th><th>Type</th><th>Rent</th><th>Status</th><th>Tenant</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${units.map(u => `
                        <tr>
                            <td><strong>${u.unit_number}</strong></td>
                            <td>${capitalize(u.unit_type)}</td>
                            <td>${formatCurrency(u.monthly_rent)}</td>
                            <td><span class="badge badge-${u.status === 'occupied' ? 'success' : u.status === 'vacant' ? 'info' : 'warning'}">${u.status}</span></td>
                            <td>${u.current_tenant ? u.current_tenant.full_name : '-'}</td>
                            <td>
                                <div class="table-actions">
                                    <button onclick="editUnit('${u.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                                    <button class="danger" onclick="deleteUnit('${u.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
        window.editUnit = (id) => editUnit(id, apartmentId);
        window.deleteUnit = (id) => deleteUnit(id, apartmentId);
    } catch (error) {
        document.getElementById('units-table').innerHTML = `<div class="error-state"><p>${error.message}</p></div>`;
    }
}

function openAddModal(apartmentId) {
    const formHtml = `
        <div class="form-group">
            <label class="form-label">Unit Number <span class="required">*</span></label>
            <input type="text" class="form-input" id="unit-number" required>
        </div>
        <div class="form-group">
            <label class="form-label">Unit Type</label>
            <select class="form-select" id="unit-type">
                ${CONFIG.UNIT_TYPES.map(t => `<option value="${t}">${capitalize(t)}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Monthly Rent (KES) <span class="required">*</span></label>
            <input type="number" class="form-input" id="unit-rent" min="0" step="100" required>
        </div>
        <div class="form-group">
            <label class="form-label">Deposit Amount (KES)</label>
            <input type="number" class="form-input" id="unit-deposit" min="0" step="100" value="0">
        </div>`;

    showFormModal('Add Unit', formHtml, async (overlay) => {
        const data = {
            apartment_id: apartmentId,
            unit_number: overlay.querySelector('#unit-number').value,
            unit_type: overlay.querySelector('#unit-type').value,
            monthly_rent: parseFloat(overlay.querySelector('#unit-rent').value),
            deposit_amount: parseFloat(overlay.querySelector('#unit-deposit').value) || 0
        };
        if (!data.unit_number || !data.monthly_rent) {
            showToast('Unit number and rent are required', 'error');
            return false;
        }
        try {
            await apiService.post('/units', data);
            showToast('Unit added!', 'success');
            loadUnits(apartmentId);
        } catch (e) {
            showToast(e.message, 'error');
            return false;
        }
    });
}

async function editUnit(unitId, apartmentId) {
    // Similar implementation for edit - fetch unit, show modal, update
    const response = await apiService.get(`/units/${unitId}`);
    if (!response.success) return;
    const u = response.data;
    const formHtml = `
        <div class="form-group">
            <label class="form-label">Unit Number</label>
            <input type="text" class="form-input" id="edit-unit-number" value="${u.unit_number}">
        </div>
        <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" id="edit-unit-type">
                ${CONFIG.UNIT_TYPES.map(t => `<option value="${t}" ${u.unit_type === t ? 'selected' : ''}>${capitalize(t)}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Rent</label>
            <input type="number" class="form-input" id="edit-unit-rent" value="${u.monthly_rent}">
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="edit-unit-status">
                ${CONFIG.UNIT_STATUSES.map(s => `<option value="${s}" ${u.status === s ? 'selected' : ''}>${capitalize(s)}</option>`).join('')}
            </select>
        </div>`;
    showFormModal('Edit Unit', formHtml, async (overlay) => {
        const updates = {
            unit_number: overlay.querySelector('#edit-unit-number').value,
            unit_type: overlay.querySelector('#edit-unit-type').value,
            monthly_rent: parseFloat(overlay.querySelector('#edit-unit-rent').value),
            status: overlay.querySelector('#edit-unit-status').value
        };
        await apiService.put(`/units/${unitId}`, updates);
        showToast('Unit updated!', 'success');
        loadUnits(apartmentId);
    });
}

async function deleteUnit(id, apartmentId) {
    const { showConfirm } = await import('../../components/modal.js');
    showConfirm('Delete Unit', 'Are you sure?', async () => {
        await apiService.delete(`/units/${id}`);
        showToast('Unit deleted', 'success');
        loadUnits(apartmentId);
    });
}
