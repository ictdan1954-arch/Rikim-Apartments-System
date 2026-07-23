import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showToast } from '../../components/toast.js';

export default async function cleanerDashboard(container) {
    const hash = window.location.hash;                     // e.g. "#/cleaning/dashboard#tasks"
    const sectionHash = hash.split('#').pop();            // "tasks", "supplies", etc.
    const section = ['tasks', 'supplies', 'salary', 'messages'].includes(sectionHash)
        ? sectionHash
        : null;

    // ----- DEDICATED SINGLE-CARD VIEW (sidebar links) -----
    if (section) {
        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem;">
                <a href="#/cleaning/dashboard" class="btn btn-sm btn-outline-secondary">← Back to Dashboard</a>
            </div>
            <div id="section-content"></div>
        `;
        document.getElementById('section-content').innerHTML = getCardHTML(section);
        await loadSectionData(section);
        window.addEventListener('hashchange', () => cleanerDashboard(container), { once: true });
        return;
    }

    // ----- DASHBOARD OVERVIEW (only summary cards, no details) -----
    container.innerHTML = `
        <div class="page-header">
            <h2>🧹 Cleaning Dashboard</h2>
            <p class="text-muted">Welcome, ${authService.user?.full_name}</p>
        </div>

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

        <div class="card" id="attendance">
            <div class="card-header">🕒 Today's Attendance</div>
            <div class="card-body" id="attendance-container"><p>Loading...</p></div>
        </div>

        <div class="card" id="announcements">
            <div class="card-header">📢 Announcements</div>
            <div class="card-body" id="announcements-container"><p>Loading...</p></div>
        </div>

        <div class="card" id="team">
            <div class="card-header">👥 My Team</div>
            <div class="card-body" id="team-container"><p>Loading team...</p></div>
        </div>

        <!-- Quick links to dedicated sections -->
        <div style="display:flex; gap:1rem; margin-top:1rem; flex-wrap:wrap;">
            <a href="#/cleaning/dashboard#tasks" class="btn btn-outline-primary btn-sm">📋 View My Tasks</a>
            <a href="#/cleaning/dashboard#supplies" class="btn btn-outline-primary btn-sm">🧴 View Supplies</a>
            <a href="#/cleaning/dashboard#salary" class="btn btn-outline-primary btn-sm">💰 View Salary</a>
            <a href="#/cleaning/dashboard#messages" class="btn btn-outline-primary btn-sm">💬 Messages</a>
        </div>
    `;

    // Load only overview data
    await Promise.allSettled([
        loadAttendance(),
        loadAnnouncements(),
        loadTeam(),
        updateQuickStats()
    ]);

    window.addEventListener('hashchange', () => cleanerDashboard(container), { once: true });
}

// ---------- HELPERS ----------
function getCardHTML(section) {
    switch (section) {
        case 'tasks':
            return `<div class="card" id="tasks"><div class="card-header">📋 My Tasks</div><div class="card-body" id="tasks-container"><p>Loading tasks...</p></div></div>`;
        case 'supplies':
            return `<div class="card" id="supplies"><div class="card-header">🧴 Supplies</div><div class="card-body" id="supplies-container"><p>Loading supplies...</p></div></div>`;
        case 'salary':
            return `<div class="card" id="salary"><div class="card-header">💰 My Salary</div><div class="card-body" id="salary-container"><p>Loading salary...</p></div></div>`;
        case 'messages':
            return `<div class="card" id="messages"><div class="card-header">💬 Messages</div><div class="card-body" id="messages-container"><button id="open-chat-btn" class="btn btn-primary btn-sm">Chat with Caretaker</button></div></div>`;
        default:
            return '';
    }
}

async function loadSectionData(section) {
    switch (section) {
        case 'tasks': await loadTasks(); break;
        case 'supplies': await loadSupplies(); break;
        case 'salary': await loadSalary(); break;
        case 'messages': await loadMessages(); break;
    }
}

// ---------- DATA FETCH FUNCTIONS (unchanged, except they now only run when section is present) ----------
async function loadAttendance() {
    const container = document.getElementById('attendance-container');
    if (!container) return;
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
    const checkinTime = localStorage.getItem('cleaner_checkin_today');
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

async function loadAnnouncements() {
    const container = document.getElementById('announcements-container');
    if (!container) return;
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

async function loadTasks() {
    const container = document.getElementById('tasks-container');
    if (!container) return;
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
        container.innerHTML = '<p>Error loading tasks.</p>';
    }
}

async function loadSupplies() {
    const container = document.getElementById('supplies-container');
    if (!container) return;
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
        document.getElementById('request-supply-btn')?.addEventListener('click', () => showSupplyRequestModal());
    } catch (err) {
        container.innerHTML = '<p>Error loading supplies.</p>';
    }
}

async function loadTeam() {
    const container = document.getElementById('team-container');
    if (!container) return;
    try {
        const res = await apiService.get('/cleaning/team');
        if (!res.success || !res.data.length) {
            container.innerHTML = '<p>No other cleaners in this apartment.</p>';
            return;
        }
        container.innerHTML = res.data.map(member => `
            <div class="team-member">
                <i class="fas fa-user-circle"></i> ${member.full_name}
                <span class="task-count">${member.tasks_today?.total || 0} pending tasks</span>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p>Error loading team.</p>';
    }
}

async function loadSalary() {
    const container = document.getElementById('salary-container');
    if (!container) return;
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
    if (!container) return;
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

async function updateQuickStats() {
    try {
        const res = await apiService.get('/cleaning/tasks');
        const statEl = document.getElementById('stat-tasks');
        if (statEl) statEl.textContent = res.success ? res.data.filter(t => t.status !== 'completed').length : 0;
    } catch (e) {}
    const checkin = localStorage.getItem('cleaner_checkin_today');
    const statCheckin = document.getElementById('stat-checkin');
    if (statCheckin) statCheckin.textContent = checkin || '--:--';
    const statAnn = document.getElementById('stat-announcements');
    if (statAnn) statAnn.textContent = 3; // placeholder
}

async function showSupplyRequestModal() {
    const { showFormModal } = await import('../../components/modal.js');
    let supplies;
    try {
        const res = await apiService.get('/cleaning/supplies');
        supplies = res.success ? res.data : [];
    } catch (e) { supplies = []; }
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
