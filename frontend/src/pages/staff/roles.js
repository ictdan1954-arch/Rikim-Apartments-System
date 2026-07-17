import { apiService } from '../../services/api.service.js';
import { showToast } from '../../components/toast.js';
import { authService } from '../../services/auth.service.js';

export default async function staffRoles(container) {
    if (authService.getRole() !== 'landlord') {
        container.innerHTML = `<div class="error-state"><h2>Access Denied</h2><p>Only landlord can manage staff roles.</p></div>`;
        return;
    }
    container.innerHTML = `
        <div class="card">
            <div class="card-header"><h3 class="card-title">Staff Roles</h3><button class="btn btn-primary" id="add-role-btn"><i class="fas fa-plus"></i> Add Role</button></div>
            <div id="roles-table" class="table-container"><div class="page-loader"><div class="spinner"></div></div></div>
        </div>`;
    document.getElementById('add-role-btn').addEventListener('click', openAddRole);
    await loadRoles();
}

async function loadRoles() {
    try {
        const response = await apiService.get('/staff/roles');
        const roles = response.success ? response.data : [];
        const table = document.getElementById('roles-table');
        if (roles.length === 0) {
            table.innerHTML = `<div class="empty-state"><h3>No roles defined</h3></div>`;
            return;
        }
        table.innerHTML = `<table class="table"><thead><tr><th>Role Name</th><th>Description</th><th>Actions</th></tr></thead><tbody>${roles.map(r => `
            <tr><td>${r.role_name}</td><td>${r.description || '-'}</td><td><button class="btn btn-sm btn-outline" onclick="editRole('${r.id}','${r.role_name}','${r.description || ''}')"><i class="fas fa-edit"></i></button> <button class="btn btn-sm btn-danger" onclick="deleteRole('${r.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join('')}</tbody></table>`;
        window.editRole = editRole;
        window.deleteRole = deleteRole;
    } catch (e) {
        document.getElementById('roles-table').innerHTML = `<div class="error-state"><p>${e.message}</p></div>`;
    }
}

function openAddRole() {
    import('../../components/modal.js').then(({ showFormModal }) => {
        const form = `<div class="form-group"><label class="form-label">Role Name</label><input class="form-input" id="role-name"></div><div class="form-group"><label class="form-label">Description</label><input class="form-input" id="role-desc"></div>`;
        showFormModal('Add Role', form, async (overlay) => {
            const name = overlay.querySelector('#role-name').value;
            if (!name) { showToast('Name required', 'error'); return false; }
            try {
                await apiService.post('/staff/roles', { role_name: name, description: overlay.querySelector('#role-desc').value });
                showToast('Role added', 'success');
                loadRoles();
            } catch (e) { showToast(e.message, 'error'); return false; }
        });
    });
}

async function editRole(id, name, desc) {
    const { showFormModal } = await import('../../components/modal.js');
    const form = `<div class="form-group"><label class="form-label">Role Name</label><input class="form-input" id="role-name" value="${name}"></div><div class="form-group"><label class="form-label">Description</label><input class="form-input" id="role-desc" value="${desc}"></div>`;
    showFormModal('Edit Role', form, async (overlay) => {
        try {
            await apiService.put(`/staff/roles/${id}`, { role_name: overlay.querySelector('#role-name').value, description: overlay.querySelector('#role-desc').value });
            showToast('Role updated', 'success');
            loadRoles();
        } catch (e) { showToast(e.message, 'error'); return false; }
    });
}

async function deleteRole(id) {
    import('../../components/modal.js').then(({ showConfirm }) => {
        showConfirm('Delete Role', 'Are you sure?', async () => {
            await apiService.delete(`/staff/roles/${id}`);
            showToast('Role deactivated', 'success');
            loadRoles();
        });
    });
}
