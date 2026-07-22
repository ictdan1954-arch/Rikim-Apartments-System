import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showToast } from '../../components/toast.js';

export default async function cleanerDashboard() {
    const container = document.getElementById('app');
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
                <div class="card-header">👥 My Team (${authService.user?.apartment})</div>
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
                    <p>Loading messages...</p>
                </div>
            </div>
        </div>
    `;

    // Fetch all data in parallel
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
    try {
        const res = await apiService.get('/cleaning/tasks'); // GET /api/cleaning/tasks
        const container = document.getElementById('tasks-container');
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

        // Add event listeners for status change
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
        document.getElementById('tasks-container').innerHTML = '<p>Error loading tasks.</p>';
    }
}

async function loadSupplies() {
    try {
        const res = await apiService.get('/cleaning/supplies'); // GET /api/cleaning/supplies
        const container = document.getElementById('supplies-container');
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

        document.getElementById('request-supply-btn').addEventListener('click', () => {
            // Open a modal to request supplies (you can reuse your modal component)
            showSupplyRequestModal();
        });
    } catch (err) {
        document.getElementById('supplies-container').innerHTML = '<p>Error loading supplies.</p>';
    }
}

async function loadTeam() {
    try {
        const res = await apiService.get('/cleaning/team'); // GET /api/cleaning/team
        const container = document.getElementById('team-container');
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
        document.getElementById('team-container').innerHTML = '<p>Error loading team.</p>';
    }
}

async function loadSalary() {
    try {
        const res = await apiService.get('/staff/salaries/my'); // or use /cleaning/salaries
        const container = document.getElementById('salary-container');
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
        document.getElementById('salary-container').innerHTML = '<p>Error loading salary.</p>';
    }
}

async function loadMessages() {
    try {
        // Reuse the existing chat system – just load recent messages
        const caretakerId = await getCaretakerId(); // You'll need to implement this
        if (!caretakerId) {
            document.getElementById('messages-container').innerHTML = '<p>No caretaker assigned.</p>';
            return;
        }
        // Just show a button to open chat; your existing chat modal can be used
        document.getElementById('messages-container').innerHTML = `
            <button id="open-chat-btn" class="btn btn-primary btn-sm">Chat with Caretaker</button>
        `;
        document.getElementById('open-chat-btn').addEventListener('click', async () => {
            const { openChatModal } = await import('../../components/chat.js');
            openChatModal(authService.user?.id, caretakerId, 'Caretaker');
        });
    } catch (err) {
        document.getElementById('messages-container').innerHTML = '<p>Error loading messages.</p>';
    }
}

async function getCaretakerId() {
    // Get the apartment's caretaker(s) – similar to tenant message logic
    try {
        const res = await apiService.get('/apartments/my/caretakers'); // or use a known endpoint
        if (res.success && res.data.length) return res.data[0].user_id;
    } catch (e) {}
    return null;
}

// Simple supply request modal (reuses your modal component)
async function showSupplyRequestModal() {
    const { showFormModal } = await import('../../components/modal.js');
    const supplies = await apiService.get('/cleaning/supplies');
    const items = supplies.data || [];
    const options = items.map(item => `<option value="${item.id}">${item.item_name} (${item.current_quantity} left)</option>`).join('');
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
        const itemName = items.find(i => i.id === itemId)?.item_name || '';
        await apiService.post('/cleaning/supplies/request', {
            supply_item_id: itemId,
            item_name: itemName,
            requested_quantity: parseInt(quantity)
        });
        showToast('Request sent to caretaker', 'success');
    });
}
