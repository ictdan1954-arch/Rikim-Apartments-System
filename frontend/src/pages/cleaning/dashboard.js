import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showToast } from '../../components/toast.js';

export default async function cleanerDashboard(container) {
    container.innerHTML = `
        <div class="page-header">
            <h2>🧹 Cleaning Dashboard</h2>
            <p class="text-muted">Welcome, ${authService.user?.full_name}</p>
        </div>

        <!-- QUICK STATS ROW -->
        <div class="quick-stats">
            <div class="stat-card">
                <i class="fas fa-tasks"></i>
                <span class="stat-value" id="stat-tasks">0</span>
                <span class="stat-label">Tasks Today</span>
            </div>
            <div class="stat-card">
                <i class="fas fa-clock"></i>
                <span class="stat-value" id="stat-checkin">--:--</span>
                <span class="stat-label">Check‑In</span>
            </div>
            <div class="stat-card">
                <i class="fas fa-bell"></i>
                <span class="stat-value" id="stat-announcements">0</span>
                <span class="stat-label">Announcements</span>
            </div>
        </div>

        <!-- ATTENDANCE CARD -->
        <div class="card" id="attendance">
            <div class="card-header">🕒 Today's Attendance</div>
            <div class="card-body" id="attendance-container">
                <p>Loading...</p>
            </div>
        </div>

        <!-- ANNOUNCEMENTS CARD -->
        <div class="card" id="announcements">
            <div class="card-header">📢 Announcements</div>
            <div class="card-body" id="announcements-container">
                <p>Loading...</p>
            </div>
        </div>

        <!-- MY TASKS CARD -->
        <div class="card" id="tasks">
            <div class="card-header">📋 My Tasks</div>
            <div class="card-body" id="tasks-container">
                <p>Loading tasks...</p>
            </div>
        </div>

        <!-- SUPPLIES CARD -->
        <div class="card" id="supplies">
            <div class="card-header">🧴 Supplies</div>
            <div class="card-body" id="supplies-container">
                <p>Loading supplies...</p>
            </div>
        </div>

        <!-- TEAM VIEW CARD -->
        <div class="card" id="team">
            <div class="card-header">👥 My Team</div>
            <div class="card-body" id="team-container">
                <p>Loading team...</p>
            </div>
        </div>

        <!-- SALARY CARD -->
        <div class="card" id="salary">
            <div class="card-header">💰 My Salary</div>
            <div class="card-body" id="salary-container">
                <p>Loading salary...</p>
            </div>
        </div>

        <!-- MESSAGES CARD -->
        <div class="card" id="messages">
            <div class="card-header">💬 Messages</div>
            <div class="card-body" id="messages-container">
                <button id="open-chat-btn" class="btn btn-primary btn-sm">Chat with Caretaker</button>
            </div>
        </div>
    `;

    // Load all sections in parallel
    Promise.all([
        loadAttendance(),
        loadAnnouncements(),
        loadTasks(),
        loadSupplies(),
        loadTeam(),
        loadSalary(),
        loadMessages(),
        updateQuickStats()
    ]).catch(err => console.error('Dashboard load error:', err));
}

// ------------------- ATTENDANCE -------------------
async function loadAttendance() {
    const container = document.getElementById('attendance-container');
    const today = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' });
    container.innerHTML = `
        <div class="attendance-row">
            <div class="attendance-item">
                <span class="label">Check‑In</span>
                <span class="value" id="checkin-time">--:--</span>
                <button id="checkin-btn" class="btn btn-sm btn-success">Check In</button>
            </div>
            <div class="attendance-item">
                <span class="label">Check‑Out</span>
                <span class="value" id="checkout-time">--:--</span>
                <button id="checkout-btn" class="btn btn-sm btn-outline-danger" disabled>Check Out</button>
            </div>
            <div class="attendance-item">
                <span class="label">Date</span>
                <span class="value">${today}</span>
            </div>
        </div>
    `;

    let checkinTime = localStorage.getItem('cleaner_checkin_today');
    if (checkinTime) {
        document.getElementById('checkin-time').textContent = checkinTime;
        document.getElementById('checkin-btn').disabled = true;
        document.getElementById('checkout-btn').disabled = false;
    }

    document.getElementById('checkin-btn')?.addEventListener('click', () => {
        const now = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('checkin-time').textContent = now;
        localStorage.setItem('cleaner_checkin_today', now);
        document.getElementById('checkin-btn').disabled = true;
        document.getElementById('checkout-btn').disabled = false;
        updateQuickStats();
        showToast('Checked in successfully', 'success');
    });

    document.getElementById('checkout-btn')?.addEventListener('click', () => {
        const now = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('checkout-time').textContent = now;
        document.getElementById('checkout-btn').disabled = true;
        showToast('Checked out. See you tomorrow!', 'success');
    });
}

// ------------------- ANNOUNCEMENTS (placeholder data) -------------------
async function loadAnnouncements() {
    const container = document.getElementById('announcements-container');
    // TODO: Replace with real API call (e.g., /cleaning/announcements)
    const announcements = [
        { date: '2026-07-22', message: 'Deep cleaning of Block B verandahs required this Friday.', priority: 'high' },
        { date: '2026-07-21', message: 'New cleaning supplies will be delivered on Monday.', priority: 'normal' },
        { date: '2026-07-20', message: 'Please remember to log your hours daily.', priority: 'normal' }
    ];

    if (!announcements.length) {
        container.innerHTML = '<p>No announcements.</p>';
        return;
    }
    container.innerHTML = announcements.map(a => `
        <div class="announcement-item ${a.priority}">
            <span class="announcement-date">${new Date(a.date).toLocaleDateString('en-KE')}</span>
            <p>${a.message}</p>
        </div>
    `).join('');
}

// ------------------- TASKS (existing) -------------------
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

// ------------------- SUPPLIES (existing) -------------------
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

// ------------------- TEAM (existing) -------------------
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

// ------------------- SALARY (existing) -------------------
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

// ------------------- MESSAGES (existing) -------------------
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

// ------------------- QUICK STATS -------------------
async function updateQuickStats() {
    try {
        const res = await apiService.get('/cleaning/tasks');
        const taskCount = res.success ? res.data.filter(t => t.status !== 'completed').length : 0;
        document.getElementById('stat-tasks').textContent = taskCount;
    } catch (e) {
        document.getElementById('stat-tasks').textContent = '?';
    }

    const checkin = localStorage.getItem('cleaner_checkin_today');
    document.getElementById('stat-checkin').textContent = checkin || '--:--';

    // Placeholder – replace with real count from API
    document.getElementById('stat-announcements').textContent = 3;
}

// ------------------- SUPPLY REQUEST MODAL (existing) -------------------
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
