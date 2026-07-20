import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showFormModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { formatCurrency, formatDate, capitalize } from '../../utils/formatters.js';
import { CONFIG } from '../../config/constants.js';

export default async function unitsList(container, params) {
    let apartmentId = params.apartmentId;
    container.innerHTML = `<div class="page-loader"><div class="spinner"></div></div>`;

    if (apartmentId === 'all') {
        const aptResponse = await apiService.get('/apartments');
        if (!aptResponse.success) return;
        const apartments = aptResponse.data;
        if (apartments.length === 0) {
            container.innerHTML = `<div class="empty-state"><h3>No apartments</h3></div>`;
            return;
        }
        apartmentId = apartments[0].id;
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
            <div class="filter-bar">
                <div class="search-bar" style="flex:1;">
                    <i class="fas fa-search"></i>
                    <input type="text" class="form-input" id="unit-search" placeholder="Search unit number...">
                </div>
                <div class="form-group" style="min-width:150px;">
                    <select class="form-select" id="type-filter">
                        <option value="">All Types</option>
                        ${CONFIG.UNIT_TYPES.map(t => `<option value="${t}">${capitalize(t)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="min-width:150px;">
                    <select class="form-select" id="status-filter">
                        <option value="">All Status</option>
                        ${CONFIG.UNIT_STATUSES.map(s => `<option value="${s}">${capitalize(s)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div id="units-summary" class="mt-2" style="display:none;"></div>
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

    const searchInput = container.querySelector('#unit-search');
    const typeFilter = container.querySelector('#type-filter');
    const statusFilter = container.querySelector('#status-filter');

    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadUnits(apartmentId), 300);
    });
    typeFilter.addEventListener('change', () => loadUnits(apartmentId));
    statusFilter.addEventListener('change', () => loadUnits(apartmentId));

    await loadUnits(apartmentId);
}

async function loadUnits(apartmentId) {
    try {
        const response = await apiService.get(`/units/apartment/${apartmentId}`);
        if (!response.success) throw new Error(response.message);
        let units = response.data;

        const searchTerm = document.getElementById('unit-search')?.value.trim().toLowerCase();
        const typeVal = document.getElementById('type-filter')?.value;
        const statusVal = document.getElementById('status-filter')?.value;

        if (searchTerm) {
            units = units.filter(u => u.unit_number.toLowerCase().includes(searchTerm));
        }
        if (typeVal) {
            units = units.filter(u => u.unit_type === typeVal);
        }
        if (statusVal) {
            units = units.filter(u => u.status === statusVal);
        }

        const table = document.getElementById('units-table');
        const summaryDiv = document.getElementById('units-summary');

        const totalUnits = units.length;
        const occupiedUnits = units.filter(u => u.status === 'occupied').length;
        const vacantUnits = units.filter(u => u.status === 'vacant').length;
        const expectedRent = units
            .filter(u => u.status === 'occupied')
            .reduce((sum, u) => sum + parseFloat(u.monthly_rent || 0), 0);

        summaryDiv.innerHTML = `
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-door-open"></i></div>
                    <div class="stat-info">
                        <div class="stat-label">Total Units</div>
                        <div class="stat-value">${totalUnits}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-home"></i></div>
                    <div class="stat-info">
                        <div class="stat-label">Occupied</div>
                        <div class="stat-value">${occupiedUnits}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon warning"><i class="fas fa-door-closed"></i></div>
                    <div class="stat-info">
                        <div class="stat-label">Vacant</div>
                        <div class="stat-value">${vacantUnits}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon info"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="stat-info">
                        <div class="stat-label">Expected Rent</div>
                        <div class="stat-value">${formatCurrency(expectedRent)}</div>
                    </div>
                </div>
            </div>
        `;
        summaryDiv.style.display = 'block';

        if (units.length === 0) {
            table.innerHTML = `<div class="empty-state"><i class="fas fa-door-closed"></i><h3>No Units Found</h3></div>`;
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
                                    <button onclick="window.editUnit('${u.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                                    <button class="danger" onclick="window.deleteUnit('${u.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                                    ${u.status === 'vacant' ? `<button class="btn btn-sm btn-outline assign-tenant-btn" data-unit-id="${u.id}" title="Assign Tenant"><i class="fas fa-user-plus"></i></button>` : ''}
                                </div>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>`;

        table.addEventListener('click', (e) => {
            const assignBtn = e.target.closest('.assign-tenant-btn');
            if (assignBtn) {
                const unitId = assignBtn.dataset.unitId;
                openAssignTenantModal(unitId, apartmentId);
            }
        });

        window.editUnit = (id) => editUnit(id, apartmentId);
        window.deleteUnit = (id) => deleteUnit(id, apartmentId);

    } catch (error) {
        document.getElementById('units-table').innerHTML = `<div class="error-state"><p>${error.message}</p></div>`;
        document.getElementById('units-summary').style.display = 'none';
    }
}

async function openAssignTenantModal(unitId, apartmentId) {
    const { showFormModal } = await import('../../components/modal.js');
    let query = '?status=active';
    if (authService.getRole() === 'caretaker') {
        query += `&apartment_id=${apartmentId}`;
    }
    const tenantsRes = await apiService.get(`/tenants${query}`);
    const tenants = tenantsRes.success ? tenantsRes.data : [];

    if (tenants.length === 0) {
        showToast('No active tenants available', 'warning');
        return;
    }

    const formHtml = `
        <p>Assign a tenant to this unit.</p>
        <div class="form-group">
            <label class="form-label">Select Tenant</label>
            <select class="form-select" id="assign-tenant">
                ${tenants.map(t => `<option value="${t.id}">${t.full_name} (${t.phone})</option>`).join('')}
            </select>
        </div>`;

    showFormModal('Assign Tenant', formHtml, async (overlay) => {
        const tenantId = overlay.querySelector('#assign-tenant').value;
        try {
            await apiService.put(`/tenants/${tenantId}`, { unit_id: unitId });
            showToast('Tenant assigned successfully', 'success');
            loadUnits(apartmentId);
        } catch (e) {
            showToast(e.message, 'error');
            return false;
        }
    });
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
