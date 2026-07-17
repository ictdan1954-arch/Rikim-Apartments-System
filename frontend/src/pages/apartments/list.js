import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { Modal, showFormModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { formatDate } from '../../utils/formatters.js';
import { router } from '../../router.js';

export default async function apartmentsList(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Apartments</h3>
                ${authService.getRole() === 'landlord' ? '<button class="btn btn-primary" id="add-apartment-btn"><i class="fas fa-plus"></i> Add Apartment</button>' : ''}
            </div>
            <div id="apartments-table" class="table-container">
                <div class="page-loader"><div class="spinner"></div></div>
            </div>
        </div>`;

    await loadApartments();

    if (authService.getRole() === 'landlord') {
        document.getElementById('add-apartment-btn')?.addEventListener('click', openAddModal);
    }
}

async function loadApartments() {
    try {
        const response = await apiService.get('/apartments');
        if (!response.success) throw new Error(response.message);
        
        const apartments = response.data;
        const tableContainer = document.getElementById('apartments-table');
        
        if (apartments.length === 0) {
            tableContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-building"></i>
                    <h3>No Apartments Yet</h3>
                    <p>Add your first apartment to get started.</p>
                </div>`;
            return;
        }

        tableContainer.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${apartments.map(a => `
                        <tr>
                            <td><strong>${a.name}</strong></td>
                            <td>${a.location}</td>
                            <td><span class="badge badge-${a.status === 'active' ? 'success' : 'secondary'}">${a.status}</span></td>
                            <td>${formatDate(a.created_at)}</td>
                            <td>
                                <div class="table-actions">
                                    <button onclick="window.router.navigate('/apartments/${a.id}')" title="View"><i class="fas fa-eye"></i></button>
                                    <button onclick="window.router.navigate('/units/${a.id}')" title="Units"><i class="fas fa-door-open"></i></button>
                                    ${authService.getRole() === 'landlord' ? `
                                    <button onclick="editApartment('${a.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                                    <button class="danger" onclick="deleteApartment('${a.id}')" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                                </div>
                            </td>
                        </tr>`).join('')}
                </tbody>
            </table>`;

        // Attach global functions
        window.editApartment = editApartment;
        window.deleteApartment = deleteApartment;
    } catch (error) {
        document.getElementById('apartments-table').innerHTML = `
            <div class="error-state">
                <p>${error.message}</p>
                <button onclick="location.reload()" class="btn btn-primary btn-sm">Retry</button>
            </div>`;
    }
}

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
        const name = overlay.querySelector('#apart-name').value;
        const location = overlay.querySelector('#apart-location').value;
        const description = overlay.querySelector('#apart-desc').value;

        if (!name || !location) {
            showToast('Name and location are required', 'error');
            return false; // don't close modal
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
                name: overlay.querySelector('#edit-name').value,
                location: overlay.querySelector('#edit-location').value,
                description: overlay.querySelector('#edit-desc').value,
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
