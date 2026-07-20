import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showFormModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { formatDate } from '../../utils/formatters.js';

export default async function apartmentsList(container) {
    const role = authService.getRole();

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Apartments</h3>
                ${role === 'landlord' 
                    ? '<button class="btn btn-primary" id="add-apartment-btn"><i class="fas fa-plus"></i> Add Apartment</button>' 
                    : ''}
            </div>
            <div class="filter-bar">
                <div class="search-bar" style="flex:1;">
                    <i class="fas fa-search"></i>
                    <input type="text" class="form-input" id="search-input" placeholder="Search by name or location...">
                </div>
                ${role === 'landlord' ? `
                <div class="form-group" style="min-width: 150px;">
                    <select class="form-select" id="status-filter">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>` : ''}
            </div>
            <div id="apartments-table" class="table-container">
                <div class="page-loader"><div class="spinner"></div></div>
            </div>
        </div>`;

    if (role === 'landlord') {
        document.getElementById('add-apartment-btn')?.addEventListener('click', openAddModal);
    }

    const searchInput = container.querySelector('#search-input');
    const statusFilter = role === 'landlord' ? container.querySelector('#status-filter') : null;

    // Debounced search
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadApartments, 300);
    });
    if (statusFilter) statusFilter.addEventListener('change', loadApartments);

    await loadApartments();

    async function loadApartments() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        const status = statusFilter?.value || '';

        try {
            const response = await apiService.get('/apartments');
            if (!response.success) throw new Error(response.message);
            let apartments = response.data;

            // Apply search filter
            if (searchTerm) {
                apartments = apartments.filter(a =>
                    a.name.toLowerCase().includes(searchTerm) ||
                    a.location.toLowerCase().includes(searchTerm)
                );
            }

            // Apply status filter
            if (status) {
                apartments = apartments.filter(a => a.status === status);
            }

            const tableContainer = document.getElementById('apartments-table');

            if (apartments.length === 0) {
                tableContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-building"></i>
                        <h3>No Apartments Found</h3>
                        <p>${searchTerm || status ? 'Try adjusting your filters.' : 'Add your first apartment to get started.'}</p>
                    </div>`;
                return;
            }

            tableContainer.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Location</th>
                            <th>Units</th>
                            <th>Occupancy</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${apartments.map(a => {
                            const total = a.unit_count || 0;
                            const occupied = a.occupied_count || 0;
                            const occupancyPercent = total ? Math.round((occupied / total) * 100) : 0;
                            const barColor = occupancyPercent >= 80 ? 'var(--secondary)' : occupancyPercent >= 40 ? 'var(--warning)' : 'var(--danger)';

                            return `
                            <tr>
                                <td>
                                    <a href="#/apartments/${a.id}" style="color: var(--primary); font-weight: 600; cursor: pointer;">
                                        ${a.name}
                                    </a>
                                </td>
                                <td>${a.location}</td>
                                <td>${occupied}/${total}</td>
                                <td>
                                    <div style="display:flex; align-items:center; gap:8px;">
                                        <div style="flex:1; background:var(--border); height:6px; border-radius:3px;">
                                            <div style="width:${occupancyPercent}%; background:${barColor}; height:100%; border-radius:3px;"></div>
                                        </div>
                                        <span style="font-size:0.85rem;">${occupancyPercent}%</span>
                                    </div>
                                </td>
                                <td><span class="badge badge-${a.status === 'active' ? 'success' : 'secondary'}">${a.status}</span></td>
                                <td>${formatDate(a.created_at)}</td>
                                <td>
                                    <div class="table-actions">
                                        <button onclick="window.router.navigate('/apartments/${a.id}')" title="View"><i class="fas fa-eye"></i></button>
                                        <button onclick="window.router.navigate('/units/${a.id}')" title="Units"><i class="fas fa-door-open"></i></button>
                                        ${role === 'landlord' ? `
                                        <button onclick="window.editApartment('${a.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                                        <button class="danger" onclick="window.deleteApartment('${a.id}')" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                                    </div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>`;

            // Attach global edit/delete functions (landlord only)
            if (role === 'landlord') {
                window.editApartment = editApartment;
                window.deleteApartment = deleteApartment;
            }
        } catch (error) {
            document.getElementById('apartments-table').innerHTML = `
                <div class="error-state">
                    <p>${error.message}</p>
                    <button onclick="location.reload()" class="btn btn-primary btn-sm">Retry</button>
                </div>`;
        }
    }

    // ---------- MODALS ----------
    function openAddModal() {
        const formHtml = `
            <div class="form-group">
                <label class="form-label">Apartment Name <span class="required">*</span></label>
                <input type="text" class="form-input" id="apart-name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Location <span class="required">*</span></label>
                <input type="text" class="form-input" id="apart-location" required>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-textarea" id="apart-desc" rows="3"></textarea>
            </div>`;

        showFormModal('Add Apartment', formHtml, async (overlay) => {
            const name = overlay.querySelector('#apart-name').value.trim();
            const location = overlay.querySelector('#apart-location').value.trim();
            const description = overlay.querySelector('#apart-desc').value.trim();

            if (!name || !location) {
                showToast('Name and location are required', 'error');
                return false;
            }

            try {
                await apiService.post('/apartments', { name, location, description });
                showToast('Apartment created!', 'success');
                loadApartments();
            } catch (error) {
                showToast(error.message, 'error');
                return false;
            }
        });
    }

    async function editApartment(id) {
        try {
            const response = await apiService.get(`/apartments/${id}`);
            if (!response.success) return;
            const a = response.data;

            const formHtml = `
                <div class="form-group">
                    <label class="form-label">Apartment Name</label>
                    <input type="text" class="form-input" id="edit-name" value="${a.name}">
                </div>
                <div class="form-group">
                    <label class="form-label">Location</label>
                    <input type="text" class="form-input" id="edit-location" value="${a.location}">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea" id="edit-desc" rows="3">${a.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select class="form-select" id="edit-status">
                        <option value="active" ${a.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${a.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>`;

            showFormModal('Edit Apartment', formHtml, async (overlay) => {
                const updates = {
                    name: overlay.querySelector('#edit-name').value.trim(),
                    location: overlay.querySelector('#edit-location').value.trim(),
                    description: overlay.querySelector('#edit-desc').value.trim(),
                    status: overlay.querySelector('#edit-status').value
                };
                await apiService.put(`/apartments/${id}`, updates);
                showToast('Apartment updated!', 'success');
                loadApartments();
            });
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function deleteApartment(id) {
        const { showConfirm } = await import('../../components/modal.js');
        showConfirm('Delete Apartment', 'Are you sure? This will remove all related data.', async () => {
            try {
                await apiService.delete(`/apartments/${id}`);
                showToast('Apartment deleted', 'success');
                loadApartments();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }
}
