import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showToast } from '../../components/toast.js';

export default async function cleanerDashboard(container) {
    // container = document.getElementById('page-content') (provided by the router)
    container.innerHTML = `
        <div class="page-header">
            <h2>🧹 Cleaning Dashboard</h2>
            <p class="text-muted">Welcome, ${authService.user?.full_name}</p>
        </div>

        <div class="dashboard-grid">
            <!-- MY TASKS CARD -->
            <div class="card">
                <div class="card-header">📋 My Tasks</div>
                <div class="card-body" id="tasks-container">
                    <p>Loading tasks...</p>
                </div>
            </div>

            <!-- SUPPLIES CARD -->
            <div class="card">
                <div class="card-header">🧴 Supplies</div>
                <div class="card-body" id="supplies-container">
                    <p>Loading supplies...</p>
                </div>
            </div>

            <!-- TEAM VIEW CARD -->
            <div class="card">
                <div class="card-header">👥 My Team</div>
                <div class="card-body" id="team-container">
                    <p>Loading team...</p>
                </div>
            </div>

            <!-- SALARY CARD -->
            <div class="card">
                <div class="card-header">💰 My Salary</div>
                <div class="card-body" id="salary-container">
                    <p>Loading salary...</p>
                </div>
            </div>

            <!-- MESSAGES CARD -->
            <div class="card">
                <div class="card-header">💬 Messages</div>
                <div class="card-body" id="messages-container">
                    <button id="open-chat-btn" class="btn btn-primary btn-sm">Chat with Caretaker</button>
                </div>
            </div>
        </div>
    `;

    // Fetch all data in parallel (each function handles its own errors)
    Promise.all([
        loadTasks(),
        loadSupplies(),
        loadTeam(),
        loadSalary(),
        loadMessages()
    ]).catch(err => console.error('Dashboard load error:', err));
}

// ------------------- DATA FETCHES -------------------
async function loadTasks() {
    const container = document.getElementById('tasks-container');
    try {
        const res = await apiService.get('/cleaning/tasks');
        if (!res.success || !res.data.length) {
            container.innerHTML = '<p>No tasks assigned yet.</p>';
            return;
        }
        container.innerHTML = res.data.map(task => `
            <div class="task-item ${task.status}">
                <div class="task-info">
                    <strong>${task.area_type}</strong> - ${task.description || 'No description'}
                    <span class="badge ${task.priority}">${task.priority}</span>
                </div>
                <div class="task-status">
                    <select data-task-id="${task.id}" class="status-select">
                        <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div class="task-date">Due: ${task.due_date || 'N/A'}</div>
            </div>
        `).join('');

        // Attach event listeners for status change
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const taskId = e.target.dataset.taskId;
                const newStatus = e.target.value;
                try {
                    await apiService.put(`/cleaning/tasks/${taskId}/status`, { status: newStatus });
                    showToast('Task status updated', 'success');
                } catch (err) {
                    showToast('Failed to update task', 'error');
                }
            });
        });
    } catch (err) {
        container.innerHTML = '<p>Error loading tasks. Please try again later.</p>';
    }
}

async function loadSupplies() {
    const container = document.getElementById('supplies-container');
    try {
        const res = await apiService.get('/cleaning/supplies');
        if (!res.success || !res.data.length) {
            container.innerHTML = '<p>No supply data.</p>';
            return;
        }
        container.innerHTML = `
            <table class="supply-table">
                <thead><tr><th>Item</th><th>Quantity</th><th>Status</th></tr></thead>
                <tbody>
                    ${res.data.map(s => `
                        <tr>
                            <td>${s.item_name}</td>
                            <td>${s.current_quantity} ${s.unit}</td>
                            <td>${s.current_quantity <= s.min_quantity ? '⚠️ Low' : '✅ OK'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <button id="request-supply-btn" class="btn btn-sm btn-primary mt-2">Request Supplies</button>
        `;

        document.getElementById('request-supply-btn')?.addEventListener('click', () => {
            showSupplyRequestModal();
        });
    } catch (err) {
        container.innerHTML = '<p>Error loading supplies.</p>';
    }
}

async function loadTeam() {
    const container = document.getElementById('team-container');
    try {
        const res = await apiService.get('/cleaning/team');
        if (!res.success || !res.data.length) {
            container.innerHTML = '<p>No other cleaners in this apartment.</p>';
            return;
        }
        container.innerHTML = res.data.map(member => `
            <div class="team-member">
                <i class="fas fa-user-circle"></i> ${member.full_name}
                <span class="task-count">${member.pending_tasks || 0} pending tasks</span>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p>Error loading team.</p>';
    }
}

async function loadSalary() {
    const container = document.getElementById('salary-container');
    try {
        const res = await apiService.get('/cleaning/salaries');
        if (!res.success || !res.data.length) {
            container.innerHTML = '<p>No salary payments recorded.</p>';
            return;
        }
        container.innerHTML = res.data.map(s => `
            <div class="salary-item">
                <span>${s.payment_date}</span>
                <span>KES ${s.amount_paid.toLocaleString()}</span>
                <span>(${s.period_start} - ${s.period_end})</span>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p>Error loading salary.</p>';
    }
}

async function loadMessages() {
    const container = document.getElementById('messages-container');
    try {
        const res = await apiService.get('/cleaning/caretaker');
        if (!res.success || !res.data) {
            container.innerHTML = '<p>No caretaker assigned.</p>';
            return;
        }
        const caretaker = res.data;
        container.innerHTML = `
            <button id="open-chat-btn" class="btn btn-primary btn-sm">Chat with Caretaker (${caretaker.users?.full_name || 'Caretaker'})</button>
        `;
        document.getElementById('open-chat-btn')?.addEventListener('click', async () => {
            const { openChatModal } = await import('../../components/chat.js');
            openChatModal(authService.user?.id, caretaker.user_id, caretaker.users?.full_name);
        });
    } catch (err) {
        container.innerHTML = '<p>Error loading caretaker info.</p>';
    }
}

async function showSupplyRequestModal() {
    const { showFormModal } = await import('../../components/modal.js');
    let supplies;
    try {
        const res = await apiService.get('/cleaning/supplies');
        supplies = res.success ? res.data : [];
    } catch (e) {
        supplies = [];
    }
    const options = supplies.map(item => `<option value="${item.id}">${item.item_name} (${item.current_quantity} left)</option>`).join('');
    const formHtml = `
        <div class="form-group">
            <label>Item</label>
            <select id="supply-item" class="form-select">${options}</select>
        </div>
        <div class="form-group">
            <label>Quantity</label>
            <input type="number" id="supply-quantity" class="form-input" min="1" value="1">
        </div>
    `;
    showFormModal('Request Supplies', formHtml, async (overlay) => {
        const itemId = overlay.querySelector('#supply-item').value;
        const quantity = overlay.querySelector('#supply-quantity').value;
        const itemName = supplies.find(i => i.id === itemId)?.item_name || '';
        try {
            await apiService.post('/cleaning/supplies/request', {
                supply_item_id: itemId,
                item_name: itemName,
                requested_quantity: parseInt(quantity)
            });
            showToast('Request sent to caretaker', 'success');
        } catch (err) {
            showToast('Failed to send request', 'error');
        }
    });
}
