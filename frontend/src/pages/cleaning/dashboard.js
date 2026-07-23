import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showToast } from '../../components/toast.js';

export default async function cleanerDashboard(container) {
    // Determine which section to show (if any)
    const hash = window.location.hash;                // e.g., "#/cleaning/dashboard#tasks"
    const sectionHash = hash.split('#').pop();        // "tasks", "supplies", etc.
    const section = ['tasks', 'supplies', 'salary', 'messages'].includes(sectionHash) ? sectionHash : null;

    // When a specific section is requested, show a back button
    if (section) {
        container.innerHTML = `
            <div class="page-header" style="display:flex;align-items:center;gap:1rem;">
                <a href="#/cleaning/dashboard" class="btn btn-sm btn-outline-secondary" style="margin-right:auto;">
                    ← Back to Dashboard
                </a>
            </div>
            <div id="section-content"></div>
        `;
        const sectionContainer = document.getElementById('section-content');
        // Render only the requested card
        sectionContainer.innerHTML = getCardHTML(section);
        // Load data only for that card
        await loadSectionData(section);
        // Re‑run hash detection if the user clicks another sidebar link
        window.addEventListener('hashchange', () => cleanerDashboard(container), { once: true });
        return;
    }

    // ---------- FULL DASHBOARD (no section specified) ----------
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

        <!-- All cards are rendered -->
        <div class="card" id="attendance">
            <div class="card-header">🕒 Today's Attendance</div>
            <div class="card-body" id="attendance-container"><p>Loading...</p></div>
        </div>

        <div class="card" id="announcements">
            <div class="card-header">📢 Announcements</div>
            <div class="card-body" id="announcements-container"><p>Loading...</p></div>
        </div>

        <div class="card" id="tasks">
            <div class="card-header">📋 My Tasks</div>
            <div class="card-body" id="tasks-container"><p>Loading tasks...</p></div>
        </div>

        <div class="card" id="supplies">
            <div class="card-header">🧴 Supplies</div>
            <div class="card-body" id="supplies-container"><p>Loading supplies...</p></div>
        </div>

        <div class="card" id="team">
            <div class="card-header">👥 My Team</div>
            <div class="card-body" id="team-container"><p>Loading team...</p></div>
        </div>

        <div class="card" id="salary">
            <div class="card-header">💰 My Salary</div>
            <div class="card-body" id="salary-container"><p>Loading salary...</p></div>
        </div>

        <div class="card" id="messages">
            <div class="card-header">💬 Messages</div>
            <div class="card-body" id="messages-container">
                <button id="open-chat-btn" class="btn btn-primary btn-sm">Chat with Caretaker</button>
            </div>
        </div>
    `;

    // Load all sections
    await Promise.allSettled([
        loadAttendance(),
        loadAnnouncements(),
        loadTasks(),
        loadSupplies(),
        loadTeam(),
        loadSalary(),
        loadMessages(),
        updateQuickStats()
    ]);

    // Re‑run component when hash changes (so back button works)
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

// ---------- DATA FETCHES (unchanged except minor guards) ----------
async function loadAttendance() {
    const container = document.getElementById('attendance-container');
    if (!container) return;
    // … (your existing attendance code) …
}

async function loadAnnouncements() {
    const container = document.getElementById('announcements-container');
    if (!container) return;
    // … (existing) …
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
    // … (existing) …
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
        const taskCount = res.success ? res.data.filter(t => t.status !== 'completed').length : 0;
        const statEl = document.getElementById('stat-tasks');
        if (statEl) statEl.textContent = taskCount;
    } catch (e) { /* ignore */ }

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
