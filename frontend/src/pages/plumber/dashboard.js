import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showToast } from '../../components/toast.js';

export default async function plumberDashboard() {
    const container = document.getElementById('app');
    container.innerHTML = `
        <div class="page-header">
            <h2>🔧 Plumber Dashboard</h2>
            <p class="text-muted">Welcome, ${authService.user?.full_name}</p>
        </div>

        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header">📋 My Jobs</div>
                <div class="card-body" id="tasks-container"><p>Loading jobs...</p></div>
            </div>
            <div class="card">
                <div class="card-header">📦 Parts & Supplies</div>
                <div class="card-body" id="supplies-container"><p>Loading inventory...</p></div>
            </div>
            <div class="card">
                <div class="card-header">👥 Other Plumbers</div>
                <div class="card-body" id="team-container"><p>Loading team...</p></div>
            </div>
            <div class="card">
                <div class="card-header">💰 My Salary</div>
                <div class="card-body" id="salary-container"><p>Loading salary...</p></div>
            </div>
            <div class="card">
                <div class="card-header">💬 Messages</div>
                <div class="card-body" id="messages-container">
                    <button id="open-chat-btn" class="btn btn-primary btn-sm">Chat with Caretaker</button>
                </div>
            </div>
        </div>
    `;

    Promise.all([loadTasks(), loadSupplies(), loadTeam(), loadSalary()])
        .catch(err => console.error(err));

    document.getElementById('open-chat-btn')?.addEventListener('click', async () => {
        const caretakerId = await getCaretakerId();
        if (caretakerId) {
            const { openChatModal } = await import('../../components/chat.js');
            openChatModal(authService.user?.id, caretakerId, 'Caretaker');
        } else {
            showToast('No caretaker assigned', 'warning');
        }
    });
}

async function loadTasks() {
    document.getElementById('tasks-container').innerHTML = `
        <div class="task-item"><strong>Unit 102</strong> - Leaky faucet <span class="badge warning">In Progress</span></div>
        <div class="task-item"><strong>Unit 105</strong> - Toilet blockage <span class="badge danger">Urgent</span></div>
        <p class="text-muted mt-2">(Placeholder data – API integration pending)</p>
    `;
}

async function loadSupplies() {
    document.getElementById('supplies-container').innerHTML = `
        <table class="supply-table">
            <tr><td>🔧 Wrenches</td><td>3</td><td>✅ OK</td></tr>
            <tr><td>🚰 PVC pipes</td><td>10m</td><td>⚠️ Low</td></tr>
            <tr><td>🧴 Drain cleaner</td><td>5 bottles</td><td>✅ OK</td></tr>
        </table>
        <p class="text-muted mt-2">(Placeholder data – API integration pending)</p>
    `;
}

async function loadTeam() {
    document.getElementById('team-container').innerHTML = `
        <div class="team-member"><i class="fas fa-user-circle"></i> Peter (assigned)</div>
        <div class="team-member"><i class="fas fa-user-circle"></i> Chris (available)</div>
        <p class="text-muted mt-2">(Placeholder data – API integration pending)</p>
    `;
}

async function loadSalary() {
    document.getElementById('salary-container').innerHTML = `
        <div class="salary-item">📅 2026-07-15: KES 20,000</div>
        <div class="salary-item">📅 2026-06-15: KES 20,000</div>
        <p class="text-muted mt-2">(Placeholder data – API integration pending)</p>
    `;
}

async function getCaretakerId() {
    try {
        const res = await apiService.get('/apartments/my/caretakers');
        if (res.success && res.data.length) return res.data[0].user_id;
    } catch (e) {}
    return null;
}
