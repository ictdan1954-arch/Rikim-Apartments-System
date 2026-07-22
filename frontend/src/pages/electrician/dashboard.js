import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showToast } from '../../components/toast.js';

export default async function electricianDashboard() {
    const container = document.getElementById('app');
    container.innerHTML = `
        <div class="page-header">
            <h2>⚡ Electrician Dashboard</h2>
            <p class="text-muted">Welcome, ${authService.user?.full_name}</p>
        </div>

        <div class="dashboard-grid">
            <!-- MY TASKS CARD -->
            <div class="card">
                <div class="card-header">📋 My Jobs</div>
                <div class="card-body" id="tasks-container">
                    <p>Loading jobs...</p>
                </div>
            </div>

            <!-- SUPPLIES CARD -->
            <div class="card">
                <div class="card-header">🧰 Parts & Tools</div>
                <div class="card-body" id="supplies-container">
                    <p>Loading inventory...</p>
                </div>
            </div>

            <!-- TEAM VIEW CARD -->
            <div class="card">
                <div class="card-header">👥 Other Electricians</div>
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

    // Load data in parallel (currently using placeholders)
    Promise.all([
        loadTasks(),
        loadSupplies(),
        loadTeam(),
        loadSalary()
    ]).catch(err => console.error('Dashboard load error:', err));

    // Chat button
    document.getElementById('open-chat-btn')?.addEventListener('click', async () => {
        const caretakerId = await getCaretakerId();
        if (caretakerId) {
            const { openChatModal } = await import('../../components/chat.js');
            openChatModal(authService.user?.id, caretakerId, 'Caretaker');
        } else {
            showToast('No caretaker assigned to your apartment', 'warning');
        }
    });
}

// ------------------- DATA FETCHES (PLACEHOLDERS) -------------------
async function loadTasks() {
    const container = document.getElementById('tasks-container');
    // TODO: replace with actual API call e.g. /electrician/tasks
    container.innerHTML = `
        <div class="task-item">
            <div class="task-info"><strong>Unit 101</strong> - Light fixture repair</div>
            <div class="task-status"><span class="badge warning">Pending</span></div>
        </div>
        <div class="task-item">
            <div class="task-info"><strong>Unit 205</strong> - No power (urgent)</div>
            <div class="task-status"><span class="badge danger">Urgent</span></div>
        </div>
        <p class="text-muted mt-2">(Placeholder data – API integration pending)</p>
    `;
}

async function loadSupplies() {
    const container = document.getElementById('supplies-container');
    container.innerHTML = `
        <table class="supply-table">
            <tr><td>🔌 Electrical wire</td><td>50m</td><td>✅ OK</td></tr>
            <tr><td>💡 Light bulbs</td><td>12 pcs</td><td>⚠️ Low</td></tr>
            <tr><td>🔧 Multimeter</td><td>1</td><td>✅ OK</td></tr>
        </table>
        <p class="text-muted mt-2">(Placeholder data – API integration pending)</p>
    `;
}

async function loadTeam() {
    const container = document.getElementById('team-container');
    container.innerHTML = `
        <div class="team-member"><i class="fas fa-user-circle"></i> Alex (in progress)</div>
        <div class="team-member"><i class="fas fa-user-circle"></i> Brian (off duty)</div>
        <p class="text-muted mt-2">(Placeholder data – API integration pending)</p>
    `;
}

async function loadSalary() {
    const container = document.getElementById('salary-container');
    container.innerHTML = `
        <div class="salary-item">📅 2026-07-15: KES 18,000</div>
        <div class="salary-item">📅 2026-06-15: KES 18,000</div>
        <p class="text-muted mt-2">(Placeholder data – API integration pending)</p>
    `;
}

async function getCaretakerId() {
    // Reuse the same logic as cleaner dashboard (fetch caretakers for this apartment)
    try {
        const res = await apiService.get('/apartments/my/caretakers'); // adjust endpoint as needed
        if (res.success && res.data.length) return res.data[0].user_id;
    } catch (e) {}
    return null;
}
