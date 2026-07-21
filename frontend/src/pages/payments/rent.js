import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { formatCurrency, formatDate, capitalize } from '../../utils/formatters.js';
import { showToast } from '../../components/toast.js';

export default async function rentPayments(container) {
    const role = authService.getRole();
    let apartments = [];
    let defaultAptId = null;
    let defaultAptName = '';

    // Caretaker: fetch assigned apartment(s)
    if (role === 'caretaker') {
        const aptRes = await apiService.get('/apartments');
        if (aptRes.success && aptRes.data.length > 0) {
            apartments = aptRes.data;
            defaultAptId = apartments[0].id;
            defaultAptName = apartments[0].name;
        }
    } else {
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
                <div class="form-group">
                    <button class="btn btn-sm btn-outline" id="btn-this-month">This Month</button>
                    <button class="btn btn-sm btn-outline" id="btn-last-month">Last Month</button>
                </div>
                <div class="search-bar" style="flex:1;">
                    <i class="fas fa-search"></i>
                    <input type="text" class="form-input" id="payment-search" placeholder="Search tenant or unit...">
                </div>
            </div>
            <div id="payment-summary" class="mt-2" style="display:none;"></div>
            <div id="payments-table" class="table-container">
                <div class="page-loader"><div class="spinner"></div></div>
            </div>
            <!-- NEW: Pending Payments section -->
            <div id="pending-payments" class="mt-2" style="display:none;"></div>
        </div>`;

    const aptSelect = container.querySelector('#filter-apartment');
    const startInput = container.querySelector('#filter-start');
    const endInput = container.querySelector('#filter-end');
    const searchInput = container.querySelector('#payment-search');
    const btnThisMonth = container.querySelector('#btn-this-month');
    const btnLastMonth = container.querySelector('#btn-last-month');
    const recordBtn = container.querySelector('#record-payment-btn');
    const paymentsTable = container.querySelector('#payments-table');
    const summaryDiv = container.querySelector('#payment-summary');
    const pendingDiv = container.querySelector('#pending-payments');

    if (role === 'landlord') {
        aptSelect.addEventListener('change', loadAll);
    }
    startInput.addEventListener('change', loadAll);
    endInput.addEventListener('change', loadAll);
    recordBtn.addEventListener('click', openRecordModal);

    // Quick date buttons
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    btnThisMonth.addEventListener('click', () => {
        startInput.value = firstDayThisMonth;
        endInput.value = lastDayThisMonth;
        loadAll();
    });
    btnLastMonth.addEventListener('click', () => {
        startInput.value = firstDayLastMonth;
        endInput.value = lastDayLastMonth;
        loadAll();
    });

    // Debounced search
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadAll, 300);
    });

    // Initial load
    loadAll();

    // ---------- Main data loading ----------
    async function loadAll() {
        await Promise.all([loadPayments(), loadPaymentStatus()]);
    }

    async function loadPayments() {
        const apartmentId = aptSelect.value;
        const start = startInput.value;
        const end = endInput.value;
        const search = searchInput.value.trim().toLowerCase();

        let query = '';
        if (apartmentId) query += `apartmentId=${apartmentId}&`;
        if (start) query += `start_date=${start}&`;
        if (end) query += `end_date=${end}&`;

        const fetchId = (role === 'caretaker') ? defaultAptId : (apartmentId || 'all');
        const endpoint = `/rent/apartment/${fetchId}?${query}`;

        try {
            const response = await apiService.get(endpoint);
            let payments = response.success ? response.data : [];

            // Client-side search filter
            if (search) {
                payments = payments.filter(p =>
                    (p.tenants?.full_name || '').toLowerCase().includes(search) ||
                    (p.units?.unit_number || '').toLowerCase().includes(search)
                );
            }

            // Summary calculations
            const totalCollected = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);
            const count = payments.length;
            const average = count ? Math.round(totalCollected / count) : 0;

            summaryDiv.innerHTML = `
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <div class="stat-card">
                        <div class="stat-icon success"><i class="fas fa-money-bill-wave"></i></div>
                        <div class="stat-info">
                            <div class="stat-label">Total Collected</div>
                            <div class="stat-value">${formatCurrency(totalCollected)}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon info"><i class="fas fa-list-ul"></i></div>
                        <div class="stat-info">
                            <div class="stat-label">Payments</div>
                            <div class="stat-value">${count}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon primary"><i class="fas fa-calculator"></i></div>
                        <div class="stat-info">
                            <div class="stat-label">Average</div>
                            <div class="stat-value">${formatCurrency(average)}</div>
                        </div>
                    </div>
                </div>
            `;
            summaryDiv.style.display = 'block';

            if (payments.length === 0) {
                paymentsTable.innerHTML = `<div class="empty-state"><i class="fas fa-money-bill-wave"></i><h3>No Payments Found</h3></div>`;
                return;
            }

            paymentsTable.innerHTML = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Date</th><th>Tenant</th><th>Unit</th><th>Amount</th><th>Period</th><th>Method</th><th>Purpose</th><th>Actions</th>
                        </tr>
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
                                <td>${capitalize(p.purpose || 'monthly_rent')}</td>
                                <td>
                                    <div class="table-actions">
                                        <button class="edit-payment-btn" data-id="${p.id}" data-amount="${p.amount_paid}" data-date="${p.payment_date}" data-start="${p.period_start}" data-end="${p.period_end}" data-method="${p.payment_method}" data-ref="${p.reference_number || ''}" data-purpose="${p.purpose || 'monthly_rent'}" title="Edit"><i class="fas fa-edit"></i></button>
                                        <button class="danger delete-payment-btn" data-id="${p.id}" title="Delete"><i class="fas fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>`;

            // Event delegation
            paymentsTable.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.edit-payment-btn');
                if (editBtn) {
                    openEditModal(editBtn.dataset);
                    return;
                }
                const deleteBtn = e.target.closest('.delete-payment-btn');
                if (deleteBtn) {
                    deletePayment(deleteBtn.dataset.id);
                    return;
                }
            });

        } catch (error) {
            paymentsTable.innerHTML = `<div class="error-state"><p>${error.message}</p></div>`;
            summaryDiv.style.display = 'none';
        }
    }

    // ---------- Payment Status Summary (NEW) ----------
    async function loadPaymentStatus() {
        const apartmentId = aptSelect.value || defaultAptId;
        const fetchId = (role === 'caretaker') ? defaultAptId : (apartmentId || 'all');
        const endpoint = `/rent/payment-status/${fetchId}`;
        try {
            const res = await apiService.get(endpoint);
            if (res.success) {
                const data = res.data;
                pendingDiv.innerHTML = `
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">This Month's Payment Status</h3></div>
                        <div class="dashboard-stats" style="grid-template-columns: repeat(2,1fr);">
                            <div class="stat-card">
                                <div class="stat-icon success"><i class="fas fa-check-circle"></i></div>
                                <div class="stat-info">
                                    <div class="stat-value">${data.paid_tenants}</div>
                                    <div class="stat-label">Paid</div>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon danger"><i class="fas fa-exclamation-circle"></i></div>
                                <div class="stat-info">
                                    <div class="stat-value">${data.unpaid_tenants}</div>
                                    <div class="stat-label">Unpaid</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${data.unpaid_list && data.unpaid_list.length > 0 ? `
                    <div class="card mt-2">
                        <div class="card-header"><h3 class="card-title">Pending Payments</h3></div>
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr><th>Tenant</th><th>Unit</th><th>Rent</th><th>Arrears</th><th>Apartment</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    ${data.unpaid_list.map(t => `
                                        <tr>
                                            <td>${t.full_name}</td>
                                            <td>${t.unit_number || '-'}</td>
                                            <td>${formatCurrency(t.monthly_rent)}</td>
                                            <td>${formatCurrency(t.arrears)}</td>
                                            <td>${t.apartment_name || '-'}</td>
                                            <td>
                                                <button class="btn btn-sm btn-primary record-pending-btn" data-tenant-id="${t.id}" data-unit-id="${t.unit_id}" data-apt-id="${t.apartment_id}" data-rent="${t.monthly_rent}">
                                                    <i class="fas fa-money-bill"></i> Record Payment
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>` : ''}`;
                pendingDiv.style.display = 'block';

                // Attach record payment handlers
                pendingDiv.querySelectorAll('.record-pending-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        openRecordModalForTenant(
                            btn.dataset.tenantId,
                            btn.dataset.unitId,
                            btn.dataset.aptId,
                            btn.dataset.rent
                        );
                    });
                });
            }
        } catch (e) {
            // silently fail – the main payments table still works
        }
    }

    // ---------- Quick Record Payment for a specific tenant ----------
    function openRecordModalForTenant(tenantId, unitId, aptId, rent) {
        const today = new Date().toISOString().split('T')[0];
        const formHtml = `
            <div class="form-group">
                <label class="form-label">Amount (KES)</label>
                <input type="number" class="form-input" id="pay-amount" min="1" step="100" value="${rent}" required>
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
                <label class="form-label">Purpose</label>
                <select class="form-select" id="pay-purpose">
                    <option value="monthly_rent">Monthly Rent</option>
                    <option value="arrears_clearance">Arrears Clearance</option>
                    <option value="deposit_topup">Deposit Top‑up</option>
                    <option value="other">Other</option>
                </select>
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

        import('../../components/modal.js').then(({ showFormModal }) => {
            showFormModal('Record Payment', formHtml, async (overlay) => {
                const data = {
                    tenant_id: tenantId,
                    unit_id: unitId,
                    apartment_id: aptId,
                    amount_paid: parseFloat(overlay.querySelector('#pay-amount').value),
                    payment_date: overlay.querySelector('#pay-date').value,
                    period_start: overlay.querySelector('#pay-start').value,
                    period_end: overlay.querySelector('#pay-end').value,
                    payment_method: overlay.querySelector('#pay-method').value,
                    reference_number: overlay.querySelector('#pay-ref').value,
                    purpose: overlay.querySelector('#pay-purpose').value
                };

                if (!data.amount_paid || !data.payment_date || !data.period_start || !data.period_end) {
                    showToast('Please fill all required fields', 'error');
                    return false;
                }

                try {
                    await apiService.post('/rent', data);
                    showToast('Payment recorded', 'success');
                    loadAll();
                } catch (e) {
                    showToast(e.message, 'error');
                    return false;
                }
            });
        });
    }

    // ---------- EDIT PAYMENT MODAL ----------
    async function openEditModal(data) {
        const { showFormModal } = await import('../../components/modal.js');
        const formHtml = `
            <div class="form-group">
                <label class="form-label">Amount (KES)</label>
                <input type="number" class="form-input" id="edit-amount" value="${data.amount}" step="100" min="1" required>
            </div>
            <div class="form-group">
                <label class="form-label">Payment Date</label>
                <input type="date" class="form-input" id="edit-date" value="${data.date}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Period Start</label>
                <input type="date" class="form-input" id="edit-start" value="${data.start}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Period End</label>
                <input type="date" class="form-input" id="edit-end" value="${data.end}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Method</label>
                <select class="form-select" id="edit-method">
                    ${['cash', 'mpesa', 'bank_transfer', 'other'].map(m => `<option value="${m}" ${m === data.method ? 'selected' : ''}>${capitalize(m)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Purpose</label>
                <select class="form-select" id="edit-purpose">
                    <option value="monthly_rent" ${data.purpose === 'monthly_rent' ? 'selected' : ''}>Monthly Rent</option>
                    <option value="arrears_clearance" ${data.purpose === 'arrears_clearance' ? 'selected' : ''}>Arrears Clearance</option>
                    <option value="deposit_topup" ${data.purpose === 'deposit_topup' ? 'selected' : ''}>Deposit Top‑up</option>
                    <option value="other" ${data.purpose === 'other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Reference</label>
                <input type="text" class="form-input" id="edit-ref" value="${data.ref}">
            </div>`;

        showFormModal('Edit Payment', formHtml, async (overlay) => {
            const updates = {
                amount_paid: parseFloat(overlay.querySelector('#edit-amount').value),
                payment_date: overlay.querySelector('#edit-date').value,
                period_start: overlay.querySelector('#edit-start').value,
                period_end: overlay.querySelector('#edit-end').value,
                payment_method: overlay.querySelector('#edit-method').value,
                purpose: overlay.querySelector('#edit-purpose').value,
                reference_number: overlay.querySelector('#edit-ref').value
            };
            if (!updates.amount_paid || !updates.payment_date || !updates.period_start || !updates.period_end) {
                showToast('All fields required', 'error');
                return false;
            }
            try {
                await apiService.put(`/rent/${data.id}`, updates);
                showToast('Payment updated', 'success');
                loadAll();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        });
    }

    // ---------- DELETE PAYMENT ----------
    async function deletePayment(id) {
        const { showConfirm } = await import('../../components/modal.js');
        showConfirm('Delete Payment', 'Are you sure you want to delete this payment?', async () => {
            try {
                await apiService.delete(`/rent/${id}`);
                showToast('Payment deleted', 'success');
                loadAll();
            } catch (e) {
                showToast(e.message, 'error');
            }
        });
    }

    // ---------- RECORD PAYMENT MODAL (unchanged) ----------
    async function openRecordModal() {
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
                <select class="form-select" id="pay-tenant" onchange="window.refreshRentDetails()">
                    ${tenants.map(t => `
                        <option value="${t.id}" data-unit="${t.unit_id}" data-apt="${t.units?.apartment_id}" data-rent="${t.units?.monthly_rent || 0}" data-phone="${t.phone || ''}">
                            ${t.full_name} - ${t.units?.unit_number || 'No unit'} (${t.phone})
                        </option>
                    `).join('')}
                </select>
                <div id="arrears-info" class="mt-1" style="font-size:0.9rem; color: var(--danger); display:none;"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Amount (KES)</label>
                <div style="display:flex; gap:8px;">
                    <input type="number" class="form-input" id="pay-amount" min="1" step="100" required style="flex:1;">
                    <button type="button" class="btn btn-sm btn-outline" onclick="window.fillRentAmount()" title="Fill monthly rent">Fill Rent</button>
                </div>
                <div id="expected-rent-info" class="mt-1" style="font-size:0.85rem; color: var(--text-secondary); display:none;"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Payment Date</label>
                <input type="date" class="form-input" id="pay-date" value="${today}" required>
            </div>
            <div class="form-group">
                <label class="form-label">Period Start</label>
                <input type="date" class="form-input" id="pay-start" value="${today}" required onchange="window.refreshRentDetails()">
            </div>
            <div class="form-group">
                <label class="form-label">Period End</label>
                <input type="date" class="form-input" id="pay-end" required onchange="window.refreshRentDetails()">
            </div>
            <div class="form-group">
                <label class="form-label">Purpose</label>
                <select class="form-select" id="pay-purpose">
                    <option value="monthly_rent">Monthly Rent</option>
                    <option value="arrears_clearance">Arrears Clearance</option>
                    <option value="deposit_topup">Deposit Top‑up</option>
                    <option value="other">Other</option>
                </select>
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
            </div>
            <div class="mt-3" id="last-payments-section" style="display:none;">
                <h4 style="font-size:0.9rem; margin-bottom:8px;">Last 3 Payments</h4>
                <div class="table-container" style="max-height:150px; overflow-y:auto;">
                    <table class="table" style="font-size:0.85rem;">
                        <thead><tr><th>Date</th><th>Amount</th><th>Period</th><th>Purpose</th></tr></thead>
                        <tbody id="last-payments-tbody"></tbody>
                    </table>
                </div>
            </div>`;

        const { showFormModal } = await import('../../components/modal.js');

        window.refreshRentDetails = async function () {
            const tenantSelect = document.querySelector('#pay-tenant');
            const arrearsDiv = document.querySelector('#arrears-info');
            const expectedDiv = document.querySelector('#expected-rent-info');
            const lastPaymentsSection = document.querySelector('#last-payments-section');
            const lastPaymentsTbody = document.querySelector('#last-payments-tbody');
            const startInput = document.querySelector('#pay-start');
            const endInput = document.querySelector('#pay-end');

            if (!tenantSelect) return;

            const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
            const tenantId = selectedOption?.value;
            const rent = parseFloat(selectedOption?.dataset.rent) || 0;

            arrearsDiv.style.display = 'none';
            if (tenantId) {
                try {
                    const res = await apiService.get(`/rent/arrears/${tenantId}`);
                    if (res.success) {
                        const arrears = res.data.arrears;
                        if (arrears > 0) {
                            arrearsDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Arrears: <strong>${formatCurrency(arrears)}</strong>`;
                            arrearsDiv.style.color = 'var(--danger)';
                        } else {
                            arrearsDiv.innerHTML = `<i class="fas fa-check-circle"></i> No arrears`;
                            arrearsDiv.style.color = 'var(--secondary)';
                        }
                        arrearsDiv.style.display = 'block';
                    }
                } catch (e) {}

                try {
                    const payRes = await apiService.get(`/tenants/${tenantId}/payments`);
                    if (payRes.success && payRes.data.length > 0) {
                        const lastThree = payRes.data.slice(0, 3);
                        lastPaymentsTbody.innerHTML = lastThree.map(p => `
                            <tr>
                                <td>${formatDate(p.payment_date)}</td>
                                <td>${formatCurrency(p.amount_paid)}</td>
                                <td>${formatDate(p.period_start)} - ${formatDate(p.period_end)}</td>
                                <td>${capitalize(p.purpose || 'monthly_rent')}</td>
                            </tr>
                        `).join('');
                        lastPaymentsSection.style.display = 'block';
                    } else {
                        lastPaymentsSection.style.display = 'none';
                    }
                } catch (e) { lastPaymentsSection.style.display = 'none'; }
            }

            expectedDiv.style.display = 'none';
            if (rent > 0 && startInput.value && endInput.value) {
                const start = new Date(startInput.value);
                const end = new Date(endInput.value);
                const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                const expectedTotal = monthsDiff * rent;
                expectedDiv.innerHTML = `Expected rent for ${monthsDiff} month${monthsDiff>1?'s':''}: <strong>${formatCurrency(expectedTotal)}</strong>`;
                expectedDiv.style.display = 'block';
            } else if (rent > 0) {
                expectedDiv.innerHTML = `Monthly rent: <strong>${formatCurrency(rent)}</strong>`;
                expectedDiv.style.display = 'block';
            }
        };

        window.fillRentAmount = function () {
            const tenantSelect = document.querySelector('#pay-tenant');
            const amountInput = document.querySelector('#pay-amount');
            if (!tenantSelect || !amountInput) return;
            const selectedOption = tenantSelect.options[tenantSelect.selectedIndex];
            const rent = parseFloat(selectedOption?.dataset.rent) || 0;
            if (rent > 0) amountInput.value = rent;
        };

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
                reference_number: overlay.querySelector('#pay-ref').value,
                purpose: overlay.querySelector('#pay-purpose').value
            };

            if (!data.tenant_id || !data.amount_paid || !data.payment_date || !data.period_start || !data.period_end) {
                showToast('Please fill all required fields', 'error');
                return false;
            }

            try {
                await apiService.post('/rent', data);
                showToast('Payment recorded', 'success');
                loadAll();
                delete window.refreshRentDetails;
                delete window.fillRentAmount;
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        });

        setTimeout(() => {
            if (window.refreshRentDetails) window.refreshRentDetails();
        }, 100);
    }
}
