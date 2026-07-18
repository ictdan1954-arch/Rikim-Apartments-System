import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { router } from '../../router.js';

export default async function dashboardPage(container) {
    const role = authService.getRole();
    
    container.innerHTML = `<div class="page-loader"><div class="spinner"></div></div>`;

    try {
        let data;
        if (role === 'landlord') {
            data = await apiService.get('/dashboard/landlord');
        } else if (role === 'caretaker') {
            data = await apiService.get('/dashboard/caretaker');
        } else {
            data = await apiService.get('/dashboard/tenant');
        }

        if (!data.success) throw new Error(data.message);

        if (role === 'tenant') {
            renderTenantDashboard(container, data.data);
        } else {
            renderAdminDashboard(container, data.data, role);
        }
    } catch (error) {
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <h2>Failed to load dashboard</h2>
                <p>${error.message}</p>
                <button onclick="location.reload()" class="btn btn-primary">Retry</button>
            </div>`;
    }
}

function renderAdminDashboard(container, data, role) {
    const canManage = role === 'landlord' || role === 'caretaker';
    
    container.innerHTML = `
        <!-- Quick Actions -->
        ${canManage ? `
        <div class="quick-actions">
            <button class="quick-action-btn" onclick="window.router.navigate('/tenants/register')">
                <i class="fas fa-user-plus"></i>
                <span>Add Tenant</span>
            </button>
            <button class="quick-action-btn" onclick="window.router.navigate('/payments/rent')">
                <i class="fas fa-money-bill-wave"></i>
                <span>Record Rent</span>
            </button>
            <button class="quick-action-btn" onclick="window.router.navigate('/expenses')">
                <i class="fas fa-receipt"></i>
                <span>Add Expense</span>
            </button>
            <button class="quick-action-btn" onclick="window.router.navigate('/staff/members')">
                <i class="fas fa-user-friends"></i>
                <span>Staff</span>
            </button>
        </div>` : ''}

        <!-- Caretaker: Show assigned apartment details -->
        ${role === 'caretaker' ? `
        <div class="card mb-2">
            <div class="card-header">
                <h3 class="card-title">My Assigned Apartment${data.total_apartments > 1 ? 's' : ''}</h3>
            </div>
            <div id="caretaker-apartments">
                <p class="text-muted p-2">Loading apartments…</p>
            </div>
        </div>` : ''}

        <!-- Stats Cards -->
        <div class="dashboard-stats">
            ${role === 'landlord' ? `
            <div class="stat-card">
                <div class="stat-icon primary"><i class="fas fa-building"></i></div>
                <div class="stat-info">
                    <div class="stat-value">${data.total_apartments}</div>
                    <div class="stat-label">Apartments</div>
                </div>
            </div>` : ''}
            <div class="stat-card">
                <div class="stat-icon success"><i class="fas fa-home"></i></div>
                <div class="stat-info">
                    <div class="stat-value">${data.occupied_units}</div>
                    <div class="stat-label">Occupied Units</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon warning"><i class="fas fa-door-open"></i></div>
                <div class="stat-info">
                    <div class="stat-value">${data.vacant_units}</div>
                    <div class="stat-label">Vacant Units</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon info"><i class="fas fa-users"></i></div>
                <div class="stat-info">
                    <div class="stat-value">${data.active_tenants}</div>
                    <div class="stat-label">Active Tenants</div>
                </div>
            </div>
        </div>

        <!-- Financial Summary -->
        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Financial Overview (This Month)</h3>
                </div>
                <div class="dashboard-stats" style="grid-template-columns: repeat(3,1fr);">
                    <div class="stat-card" style="flex-direction: column; align-items: flex-start;">
                        <div class="stat-label">Expected Rent</div>
                        <div class="stat-value" style="font-size:1.3rem;">${formatCurrency(data.expected_monthly_rent)}</div>
                    </div>
                    <div class="stat-card" style="flex-direction: column; align-items: flex-start;">
                        <div class="stat-label">Collected</div>
                        <div class="stat-value" style="font-size:1.3rem; color: var(--secondary);">${formatCurrency(data.rent_collected_this_month)}</div>
                    </div>
                    <div class="stat-card" style="flex-direction: column; align-items: flex-start;">
                        <div class="stat-label">Expenses</div>
                        <div class="stat-value" style="font-size:1.3rem; color: var(--danger);">${formatCurrency(data.expenses_this_month)}</div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Quick Summary</h3>
                </div>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-light);">
                        <span>Net Income</span>
                        <strong style="color: ${data.net_income_this_month >= 0 ? 'var(--secondary)' : 'var(--danger)'}">${formatCurrency(data.net_income_this_month)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-light);">
                        <span>Total Units</span>
                        <strong>${data.total_units}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-light);">
                        <span>Pending Maintenance</span>
                        <strong>${data.pending_maintenance}</strong>
                    </div>
                </div>
            </div>
        </div>
    `;

    // If caretaker, fetch and display their assigned apartments
    if (role === 'caretaker') {
        fetchCaretakerApartments();
    }
}

async function fetchCaretakerApartments() {
    try {
        const res = await apiService.get('/apartments');
        if (!res.success || !res.data.length) {
            const el = document.getElementById('caretaker-apartments');
            if (el) el.innerHTML = `<p class="text-muted p-2">No apartment assigned yet.</p>`;
            return;
        }

        const apartments = res.data;
        const html = apartments.map(a => `
            <div class="info-card mb-1" onclick="window.router.navigate('/apartments/${a.id}')" style="cursor:pointer;">
                <div class="info-card-icon"><i class="fas fa-building"></i></div>
                <div class="info-card-content">
                    <h4>${a.name}</h4>
                    <p>${a.location}</p>
                </div>
                <span class="badge badge-${a.status === 'active' ? 'success' : 'secondary'}">${a.status}</span>
            </div>
        `).join('');

        const el = document.getElementById('caretaker-apartments');
        if (el) el.innerHTML = html;
    } catch (e) {
        const el = document.getElementById('caretaker-apartments');
        if (el) el.innerHTML = `<p class="text-muted p-2">Could not load apartments.</p>`;
    }
}

function renderTenantDashboard(container, data) {
    if (!data.tenant) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-home"></i>
                <h3>No Active Tenancy</h3>
                <p>You don't have an active lease at the moment.</p>
            </div>`;
        return;
    }

    const t = data.tenant;
    const p = data.payment_summary;
    
    container.innerHTML = `
        <div class="tenant-dashboard">
            <div class="tenant-info-card">
                <div class="tenant-name">Welcome, ${t.full_name}</div>
                <div class="unit-badge">${t.unit_number} - ${formatCurrency(t.monthly_rent)}/month</div>
            </div>

            ${p.arrears > 0 ? `
            <div class="arrears-alert mb-2">
                <i class="fas fa-exclamation-triangle"></i>
                <span>You have arrears of <strong>${formatCurrency(p.arrears)}</strong>. Please make payment soon.</span>
            </div>` : ''}

            <div class="dashboard-grid">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Payment Summary</h3></div>
                    <div class="dashboard-stats" style="grid-template-columns: repeat(2,1fr);">
                        <div class="stat-card">
                            <div class="stat-icon success"><i class="fas fa-check-circle"></i></div>
                            <div class="stat-info">
                                <div class="stat-value" style="font-size:1.2rem;">${formatCurrency(p.total_paid)}</div>
                                <div class="stat-label">Total Paid</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon ${p.arrears > 0 ? 'danger' : 'success'}">
                                <i class="fas ${p.arrears > 0 ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value" style="font-size:1.2rem;">${formatCurrency(p.arrears)}</div>
                                <div class="stat-label">Arrears</div>
                            </div>
                        </div>
                    </div>
                    ${p.recent_payments?.length ? `
                    <h4 style="margin-top:20px; font-size:0.9rem;">Recent Payments</h4>
                    <div class="table-container" style="margin-top:8px;">
                        <table class="table">
                            <thead><tr><th>Date</th><th>Amount</th><th>Method</th></tr></thead>
                            <tbody>
                                ${p.recent_payments.map(pmt => `
                                <tr>
                                    <td>${formatDate(pmt.payment_date)}</td>
                                    <td>${formatCurrency(pmt.amount_paid)}</td>
                                    <td>${pmt.payment_method}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>` : '<p class="text-muted mt-2">No payments recorded yet.</p>'}
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">My Maintenance Requests</h3></div>
                    ${data.maintenance_requests?.length ? 
                        data.maintenance_requests.slice(0,5).map(r => `
                        <div class="info-card mb-1">
                            <div class="info-card-icon"><i class="fas fa-tools"></i></div>
                            <div class="info-card-content">
                                <h4>${r.title}</h4>
                                <p><span class="badge badge-${r.status === 'resolved' ? 'success' : r.status === 'in_progress' ? 'info' : 'warning'}">${r.status}</span></p>
                            </div>
                        </div>`).join('') 
                        : '<p class="text-muted">No maintenance requests.</p>'
                    }
                    <button class="btn btn-primary btn-sm mt-2" onclick="window.router.navigate('/maintenance/tenant')">View All</button>
                </div>
            </div>
        </div>
    `;
}
