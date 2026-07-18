import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { formatCurrency, formatDate, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';

export default async function rentPayments(container) {
    const role = authService.getRole();
    let apartments = [];
    let defaultAptId = null;
    let defaultAptName = '';

    // Caretaker: fetch their assigned apartment(s)
    if (role === 'caretaker') {
        const aptRes = await apiService.get('/apartments');
        if (aptRes.success && aptRes.data.length > 0) {
            apartments = aptRes.data;
            defaultAptId = apartments[0].id;
            defaultAptName = apartments[0].name;
        }
    } else {
        // Landlord: load all apartments for the dropdown
        const aptRes = await apiService.get('/apartments');
        apartments = aptRes.success ? aptRes.data : [];
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Rent Payments${defaultAptName ? ` – ${defaultAptName}` : ''}</h3>
                <button class="btn btn-primary" id="record-payment-btn">
                    <i class="fas fa-plus"></i> Record Payment
                </button>
            </div>
            <div class="filter-bar">
                ${role === 'landlord' ? `
                <div class="form-group">
                    <select class="form-select" id="filter-apartment">
                        <option value="">All Apartments</option>
                        ${apartments.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                    </select>
                </div>` : `
                <div class="form-group">
                    <input type="hidden" id="filter-apartment" value="${defaultAptId}">
                    <p class="text-muted" style="margin:0; padding-top:8px;">
                        Showing payments for <strong>${defaultAptName}</strong>
                    </p>
                </div>`}
                <div class="form-group">
                    <input type="date" class="form-input" id="filter-start" placeholder="Start date">
                </div>
                <div class="form-group">
                    <input type="date" class="form-input" id="filter-end" placeholder="End date">
                </div>
            </div>
            <div id="payments-table" class="table-container">
                <div class="page-loader"><div class="spinner"></div></div>
            </div>
        </div>`;

    const aptSelect = container.querySelector('#filter-apartment');
    const startInput = container.querySelector('#filter-start');
    const endInput = container.querySelector('#filter-end');
    const recordBtn = container.querySelector('#record-payment-btn');
    const paymentsTable = container.querySelector('#payments-table');

    if (role === 'landlord') {
        aptSelect.addEventListener('change', loadPayments);
    }
    startInput.addEventListener('change', loadPayments);
    endInput.addEventListener('change', loadPayments);
    recordBtn.addEventListener('click', openRecordModal);

    // Initial load
    loadPayments();

    async function loadPayments() {
        const apartmentId = aptSelect.value;
        const start = startInput.value;
        const end = endInput.value;

        // Build query parameters
        let query = '';
        if (apartmentId) query += `apartmentId=${apartmentId}&`;
        if (start) query += `start_date=${start}&`;
        if (end) query += `end_date=${end}&`;

        // For caretaker, use the fixed apartmentId; for landlord, use selected (or 'all')
        const fetchId = (role === 'caretaker') ? defaultAptId : (apartmentId || 'all');
        const endpoint = `/rent/apartment/${fetchId}?${query}`;

        try {
            const response = await apiService.get(endpoint);
            const payments = response.success ? response.data : [];

            if (payments.length === 0) {
                paymentsTable.innerHTML = `<div class="empty-state"><i class="fas fa-money-bill-wave"></i><h3>No Payments</h3></div>`;
                return;
            }

            paymentsTable.innerHTML = `
                <table class="table">
                    <thead>
                        <tr><th>Date</th><th>Tenant</th><th>Unit</th><th>Amount</th><th>Period</th><th>Method</th></tr>
                    </thead>
                    <tbody>
                        ${payments.map(p => `
                            <tr>
                                <td>${formatDate(p.payment_date)}</td>
                                <td>${p.tenants?.full_name || 'N/A'}</td>
                                <td>${p.units?.unit_number || 'N/A'}</td>
                                <td>${formatCurrency(p.amount_paid)}</td>
                                <td>${formatDate(p.period_start)} - ${formatDate(p.period_end)}</td>
                                <td>${capitalize(p.payment_method)}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>`;
        } catch (error) {
            paymentsTable.innerHTML = `<div class="error-state"><p>${error.message}</p></div>`;
        }
    }

    async function openRecordModal() {
        const { showFormModal } = await import('../../components/modal.js');

        // Fetch active tenants – for caretaker, filter by their apartment(s)
        let tenantsQuery = '?status=active';
        if (role === 'caretaker' && defaultAptId) {
            tenantsQuery += `&apartment_id=${defaultAptId}`;
        }
        const tenantsRes = await apiService.get(`/tenants${tenantsQuery}`);
        const tenants = tenantsRes.success ? tenantsRes.data : [];

        if (tenants.length === 0) {
            showToast('No active tenants available', 'warning');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const formHtml = `
            <div class="form-group">
                <label class="form-label">Tenant</label>
                <select class="form-select" id="pay-tenant">
                    ${tenants.map(t => `<option value="${t.id}" data-unit="${t.unit_id}" data-apt="${t.units?.apartment_id}">${t.full_name} - ${t.units?.unit_number || 'No unit'}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Amount (KES)</label>
                <input type="number" class="form-input" id="pay-amount" min="1" step="100" required>
            </div>
            <div class="form-group">
                <label class="form-label">Payment Date</label>
                <input type="date" class="form-input" id="pay-date" value="${today}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Period Start</label>
                <input type="date" class="form-input" id="pay-start" value="${today}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Period End</label>
                <input type="date" class="form-input" id="pay-end" required>
            </div>
            <div class="form-group">
                <label class="form-label">Method</label>
                <select class="form-select" id="pay-method">
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Reference</label>
                <input type="text" class="form-input" id="pay-ref">
            </div>`;

        showFormModal('Record Payment', formHtml, async (overlay) => {
            const tenantSelect = overlay.querySelector('#pay-tenant');
            const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
            const data = {
                tenant_id: tenantSelect.value,
                unit_id: selectedOption.dataset.unit,
                apartment_id: selectedOption.dataset.apt,
                amount_paid: parseFloat(overlay.querySelector('#pay-amount').value),
                payment_date: overlay.querySelector('#pay-date').value,
                period_start: overlay.querySelector('#pay-start').value,
                period_end: overlay.querySelector('#pay-end').value,
                payment_method: overlay.querySelector('#pay-method').value,
                reference_number: overlay.querySelector('#pay-ref').value
            };

            if (!data.tenant_id || !data.amount_paid || !data.payment_date || !data.period_start || !data.period_end) {
                showToast('Please fill all required fields', 'error');
                return false;
            }

            try {
                await apiService.post('/rent', data);
                showToast('Payment recorded', 'success');
                loadPayments();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        });
    }
}
