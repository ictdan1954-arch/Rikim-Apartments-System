import { apiService } from '../../services/api.service.js';
import { formatCurrency, formatDate, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';

// Roles that are considered "technical" – they see full task management
const TECHNICAL_ROLES = ['plumber', 'electrician', 'maintenance technician'];

export async function renderStaffDashboard(container, data) {
    const staff = data.staff;
    const salaries = data.salaries || [];
    const tasks = data.tasks || [];
    const announcements = data.announcements || [];

    if (!staff) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-tie"></i>
                <h3>No staff profile found</h3>
                <p>Your account is not linked to an active staff member.</p>
            </div>`;
        return;
    }

    const roleName = (staff.staff_roles?.role_name || '').toLowerCase();
    const isTechnical = TECHNICAL_ROLES.includes(roleName);

    // Helper to render task action buttons for technical staff
    function renderTaskActions(task) {
        if (!isTechnical) return '';

        let buttons = '';
        if (task.status === 'reported') {
            buttons += `<button class="btn btn-sm btn-outline start-task-btn" data-id="${task.id}" title="Start Working"><i class="fas fa-play"></i> Start</button>`;
        }
        if (task.status === 'in_progress') {
            buttons += `<button class="btn btn-sm btn-outline resolve-task-btn" data-id="${task.id}" title="Mark Resolved"><i class="fas fa-check"></i> Resolve</button>`;
        }
        // Always allow comment
        buttons += `<button class="btn btn-sm btn-outline comment-task-btn" data-id="${task.id}" title="Add Comment"><i class="fas fa-comment"></i></button>`;
        return buttons;
    }

    container.innerHTML = `
        <!-- Profile Card -->
        <div class="card mb-2">
            <div class="card-header">
                <h3 class="card-title">My Profile</h3>
            </div>
            <div class="dashboard-stats" style="grid-template-columns: repeat(3,1fr);">
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-user"></i></div>
                    <div class="stat-info">
                        <div class="stat-label">Name</div>
                        <div class="stat-value" style="font-size:1rem;">${staff.full_name}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon info"><i class="fas fa-briefcase"></i></div>
                    <div class="stat-info">
                        <div class="stat-label">Role</div>
                        <div class="stat-value" style="font-size:1rem;">${staff.staff_roles?.role_name || 'N/A'}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-building"></i></div>
                    <div class="stat-info">
                        <div class="stat-label">Apartment</div>
                        <div class="stat-value" style="font-size:1rem;">${staff.apartments?.name || 'N/A'}</div>
                    </div>
                </div>
            </div>
            <div class="mt-2">
                <p><strong>Phone:</strong> ${staff.phone}</p>
                <p><strong>Monthly Salary:</strong> ${formatCurrency(staff.monthly_salary)}</p>
                <p><strong>Date Hired:</strong> ${formatDate(staff.date_hired)}</p>
            </div>
        </div>

        <!-- Salary History (shown to all staff) -->
        <div class="card mb-2">
            <div class="card-header">
                <h3 class="card-title">Recent Salary Payments</h3>
            </div>
            <div class="table-container">
                ${salaries.length > 0 ? `
                <table class="table">
                    <thead>
                        <tr><th>Date</th><th>Amount</th><th>Period</th><th>Method</th></tr>
                    </thead>
                    <tbody>
                        ${salaries.map(s => `
                            <tr>
                                <td>${formatDate(s.payment_date)}</td>
                                <td>${formatCurrency(s.amount_paid)}</td>
                                <td>${formatDate(s.period_start)} - ${formatDate(s.period_end)}</td>
                                <td>${capitalize(s.payment_method)}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>` : '<p class="text-muted p-2">No salary payments recorded.</p>'}
            </div>
        </div>

        <!-- Tasks Section – detailed for technical roles, simple for others -->
        ${isTechnical ? `
        <div class="card mb-2">
            <div class="card-header">
                <h3 class="card-title">My Assigned Tasks</h3>
            </div>
            <div class="table-container">
                ${tasks.length > 0 ? `
                <table class="table">
                    <thead>
                        <tr><th>Title</th><th>Unit</th><th>Priority</th><th>Status</th><th>Reported</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${tasks.map(t => `
                            <tr>
                                <td>${t.title}</td>
                                <td>${t.units?.unit_number || 'N/A'}</td>
                                <td><span class="badge badge-${t.priority === 'high' || t.priority === 'urgent' ? 'danger' : 'warning'}">${t.priority}</span></td>
                                <td><span class="badge badge-${t.status === 'in_progress' ? 'info' : 'warning'}">${t.status}</span></td>
                                <td>${formatDate(t.date_reported)}</td>
                                <td>
                                    <div class="table-actions">
                                        ${renderTaskActions(t)}
                                    </div>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>` : '<p class="text-muted p-2">No tasks assigned.</p>'}
            </div>
        </div>` : `
        <div class="card mb-2">
            <div class="card-header">
                <h3 class="card-title">Assigned Tasks</h3>
            </div>
            ${tasks.length > 0 ? tasks.map(t => `
                <div class="info-card mb-1">
                    <div class="info-card-icon"><i class="fas fa-tools"></i></div>
                    <div class="info-card-content">
                        <h4>${t.title}</h4>
                        <p>${t.units?.unit_number || 'N/A'} – ${capitalize(t.status)}</p>
                    </div>
                </div>
            `).join('') : '<p class="text-muted p-2">No tasks assigned.</p>'}
        </div>`}

        <!-- Announcements (shown to all) -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Announcements</h3>
            </div>
            ${announcements.length > 0 ? 
                announcements.map(a => `
                    <div class="info-card mb-1">
                        <div class="info-card-icon"><i class="fas fa-bullhorn"></i></div>
                        <div class="info-card-content">
                            <h4>${a.title}</h4>
                            <p>${a.message || ''}</p>
                            <small class="text-muted">${formatDate(a.created_at)}</small>
                        </div>
                    </div>
                `).join('') 
                : '<p class="text-muted p-2">No announcements.</p>'
            }
        </div>
    `;

    // Attach event listeners for task actions (only if technical)
    if (isTechnical) {
        container.addEventListener('click', async (e) => {
            const startBtn = e.target.closest('.start-task-btn');
            if (startBtn) {
                const taskId = startBtn.dataset.id;
                try {
                    await apiService.put(`/maintenance/${taskId}`, { status: 'in_progress' });
                    showToast('Task started', 'success');
                    location.reload();
                } catch (err) { showToast(err.message, 'error'); }
                return;
            }

            const resolveBtn = e.target.closest('.resolve-task-btn');
            if (resolveBtn) {
                const taskId = resolveBtn.dataset.id;
                try {
                    await apiService.put(`/maintenance/${taskId}`, { status: 'resolved' });
                    showToast('Task resolved', 'success');
                    location.reload();
                } catch (err) { showToast(err.message, 'error'); }
                return;
            }

            const commentBtn = e.target.closest('.comment-task-btn');
            if (commentBtn) {
                const taskId = commentBtn.dataset.id;
                const { showFormModal } = await import('../../components/modal.js');
                const formHtml = `
                    <div class="form-group">
                        <label class="form-label">Comment</label>
                        <textarea class="form-textarea" id="task-comment" rows="2"></textarea>
                    </div>`;
                showFormModal('Add Comment', formHtml, async (overlay) => {
                    const comment = overlay.querySelector('#task-comment').value.trim();
                    if (!comment) { showToast('Comment required', 'error'); return false; }
                    try {
                        await apiService.post(`/maintenance/${taskId}/comments`, { comment });
                        showToast('Comment added', 'success');
                        location.reload();
                    } catch (err) { showToast(err.message, 'error'); return false; }
                });
                return;
            }
        });
    }
}
