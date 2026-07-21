import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { formatCurrency, formatDate, capitalize } from '../../utils/formatters.js';
import { router } from '../../router.js';
import { showToast } from '../../components/toast.js';
import { openChatModal } from '../../components/chat.js';

export default async function tenantDetails(container, params) {
    const id = params.id === 'my' ? null : params.id;
    container.innerHTML = `<div class="page-loader"><div class="spinner"></div></div>`;

    try {
        let tenant;
        if (id) {
            // Landlord/Caretaker viewing a specific tenant
            const response = await apiService.get(`/tenants/${id}`);
            if (!response.success) throw new Error(response.message || 'Tenant not found');
            tenant = response.data;
        } else {
            // Tenant viewing their own details
            const response = await apiService.get('/dashboard/tenant');
            if (!response.success || !response.data.tenant) throw new Error('No tenancy found');
            tenant = response.data.tenant;
        }

        // Always fetch payments (no more conditional skip for tenant's own view)
        let payments = [];
        try {
            const paymentsResponse = await apiService.get(`/tenants/${tenant.id}/payments`);
            if (paymentsResponse.success) {
                payments = paymentsResponse.data;
            }
        } catch (e) { /* ignore payment fetch errors */ }

        // For tenant's own view, the unit info is already included; for landlord view, it's nested
        const unitNumber = id ? tenant.units?.unit_number : tenant.unit_number;
        const apartmentName = id ? tenant.units?.apartments?.name : tenant.apartment_name;
        const monthlyRent = id ? tenant.units?.monthly_rent : tenant.monthly_rent;

        container.innerHTML = `
            <div class="mb-2">
                <button class="btn btn-outline btn-sm" onclick="window.router.navigate('/tenants')">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
            </div>
            <div class="card mb-2">
                <div class="card-header">
                    <div>
                        <h2>${tenant.full_name}</h2>
                        <p class="text-muted">${tenant.phone} | ${tenant.email || 'No email'}</p>
                    </div>
                    <span class="badge badge-${tenant.status === 'active' ? 'success' : 'secondary'}">${tenant.status}</span>
                </div>
                <div class="dashboard-stats" style="grid-template-columns: repeat(2,1fr);">
                    <div class="stat-card">
                        <div class="stat-icon primary"><i class="fas fa-door-open"></i></div>
                        <div class="stat-info">
                            <div class="stat-label">Unit</div>
                            <div class="stat-value" style="font-size:1rem;">${unitNumber || 'N/A'}</div>
                            <div class="stat-label">${apartmentName || ''}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon success"><i class="fas fa-calendar"></i></div>
                        <div class="stat-info">
                            <div class="stat-label">Lease Period</div>
                            <div class="stat-value" style="font-size:1rem;">${formatDate(tenant.lease_start_date)}</div>
                            <div class="stat-label">to ${tenant.lease_end_date ? formatDate(tenant.lease_end_date) : 'Ongoing'}</div>
                        </div>
                    </div>
                </div>
                <div class="mt-2">
                    <p><strong>Monthly Rent:</strong> ${formatCurrency(monthlyRent || 0)}</p>
                    <p><strong>Deposit Paid:</strong> ${formatCurrency(tenant.deposit_paid || 0)}</p>
                    <p><strong>Water Deposit:</strong> ${formatCurrency(tenant.water_deposit || 0)}</p>
                    <p><strong>Electricity Deposit:</strong> ${formatCurrency(tenant.electricity_deposit || 0)}</p>
                    ${tenant.id_number ? `<p><strong>ID Number:</strong> ${tenant.id_number}</p>` : ''}
                    ${tenant.move_out_date ? `<p><strong>Move Out Date:</strong> ${formatDate(tenant.move_out_date)}</p>` : ''}
                    ${tenant.move_out_reason ? `<p><strong>Reason:</strong> ${tenant.move_out_reason}</p>` : ''}
                </div>
                ${tenant.status === 'active' ? `
                <div style="display:flex; gap:12px; margin-top:16px; flex-wrap:wrap;">
                    ${id ? `
                    <button class="btn btn-outline" id="change-unit-btn">
                        <i class="fas fa-exchange-alt"></i> Change Unit
                    </button>
                    <button class="btn btn-outline" id="move-out-btn">
                        <i class="fas fa-sign-out-alt"></i> Move Out / Transfer
                    </button>
                    <button class="btn btn-outline" id="show-credentials-btn">
                        <i class="fas fa-key"></i> Show Credentials
                    </button>
                    <button class="btn btn-outline" id="msg-tenant-btn">
                        <i class="fas fa-envelope"></i> Message
                    </button>` : `
                    <button class="btn btn-outline" id="msg-caretaker-btn">
                        <i class="fas fa-envelope"></i> Message Caretaker
                    </button>`}
                </div>` : ''}
            </div>

            <!-- Payments Table -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Payment History</h3>
                    ${id ? `<button class="btn btn-primary btn-sm" id="record-payment-btn">
                        <i class="fas fa-plus"></i> Record Payment</button>` : ''}
                </div>
                <div class="table-container">
                    ${payments.length > 0 ? `
                    <table class="table">
                        <thead>
                            <tr><th>Date</th><th>Amount</th><th>Period</th><th>Method</th><th>Reference</th></tr>
                        </thead>
                        <tbody>
                            ${payments.map(p => `
                                <tr>
                                    <td>${formatDate(p.payment_date)}</td>
                                    <td>${formatCurrency(p.amount_paid)}</td>
                                    <td>${formatDate(p.period_start)} - ${formatDate(p.period_end)}</td>
                                    <td>${capitalize(p.payment_method)}</td>
                                    <td>${p.reference_number || '-'}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>` : '<p class="text-muted p-2">No payments recorded.</p>'}
                </div>
            </div>`;

        // Event listeners for the active tenant buttons
        if (tenant.status === 'active') {
            if (id) {
                // Landlord/Caretaker viewing tenant
                document.getElementById('change-unit-btn').addEventListener('click', () => openChangeUnitModal(tenant));
                document.getElementById('move-out-btn').addEventListener('click', () => openMoveOutModal(tenant));
                document.getElementById('show-credentials-btn').addEventListener('click', () => showCredentialsModal(tenant));
                document.getElementById('msg-tenant-btn').addEventListener('click', () => {
                    openChatModal(authService.user?.id, tenant.user_id, tenant.full_name);
                });
                document.getElementById('record-payment-btn')?.addEventListener('click', () => {
                    recordPayment(tenant.id, tenant.unit_id || tenant.units?.id, tenant.units?.apartment_id);
                });
            } else {
                // Tenant viewing their own details
                document.getElementById('msg-caretaker-btn').addEventListener('click', async () => {
                    try {
                        const aptId = tenant.apartment_id;
                        const res = await apiService.get(`/apartments/${aptId}/caretakers`);
                        if (!res.success || !res.data.length) {
                            showToast('No caretaker assigned to your apartment', 'warning');
                            return;
                        }
                        const caretakers = res.data;
                        if (caretakers.length === 1) {
                            const c = caretakers[0];
                            openChatModal(authService.user?.id, c.user_id, c.users?.full_name);
                        } else {
                            const { showFormModal } = await import('../../components/modal.js');
                            const formHtml = `
                                <div class="form-group">
                                    <label class="form-label">Select Caretaker</label>
                                    <select class="form-select" id="caretaker-select">
                                        ${caretakers.map(c => `<option value="${c.user_id}">${c.users?.full_name}</option>`).join('')}
                                    </select>
                                </div>`;
                            showFormModal('Message Caretaker', formHtml, async (overlay) => {
                                const selectedId = overlay.querySelector('#caretaker-select').value;
                                const selectedName = caretakers.find(c => c.user_id === selectedId)?.users?.full_name;
                                openChatModal(authService.user?.id, selectedId, selectedName);
                            });
                        }
                    } catch (e) {
                        showToast('Could not load caretakers', 'error');
                    }
                });
            }
        }

        window.recordPayment = recordPayment;

    } catch (error) {
        container.innerHTML = `<div class="error-state"><h2>Error</h2><p>${error.message}</p></div>`;
    }
}

// Payment recording
function recordPayment(tenantId, unitId, apartmentId) {
    import('../../components/modal.js').then(({ showFormModal }) => {
        const today = new Date().toISOString().split('T')[0];
        const formHtml = `
            <div class="form-group"><label class="form-label">Amount (KES)</label><input type="number" class="form-input" id="pay-amount" min="1" step="100" required></div>
            <div class="form-group"><label class="form-label">Payment Date</label><input type="date" class="form-input" id="pay-date" value="${today}" required></div>
            <div class="form-group"><label class="form-label">Period Start</label><input type="date" class="form-input" id="pay-start" value="${today}" required></div>
            <div class="form-group"><label class="form-label">Period End</label><input type="date" class="form-input" id="pay-end" required></div>
            <div class="form-group"><label class="form-label">Method</label><select class="form-select" id="pay-method">
                <option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank_transfer">Bank Transfer</option><option value="other">Other</option></select></div>
            <div class="form-group"><label class="form-label">Reference</label><input type="text" class="form-input" id="pay-ref"></div>
        `;
        showFormModal('Record Rent Payment', formHtml, async (overlay) => {
            const data = {
                tenant_id: tenantId,
                unit_id: unitId,
                apartment_id: apartmentId,
                amount_paid: parseFloat(overlay.querySelector('#pay-amount').value),
                payment_date: overlay.querySelector('#pay-date').value,
                period_start: overlay.querySelector('#pay-start').value,
                period_end: overlay.querySelector('#pay-end').value,
                payment_method: overlay.querySelector('#pay-method').value,
                reference_number: overlay.querySelector('#pay-ref').value
            };
            if (!data.amount_paid || !data.payment_date || !data.period_start || !data.period_end) {
                showToast('All fields required', 'error');
                return false;
            }
            try {
                await apiService.post('/rent', data);
                showToast('Payment recorded', 'success');
                location.reload();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        });
    });
}

// Change Unit modal (only used when landlord/caretaker views)
async function openChangeUnitModal(tenant) {
    const { showFormModal } = await import('../../components/modal.js');

    let apartmentId;
    if (authService.getRole() === 'caretaker') {
        const aptRes = await apiService.get('/apartments');
        if (aptRes.success && aptRes.data.length > 0) {
            apartmentId = aptRes.data[0].id;
        }
    } else {
        apartmentId = tenant.units?.apartment_id;
    }

    if (!apartmentId) {
        showToast('Could not determine apartment', 'error');
        return;
    }

    const unitsRes = await apiService.get(`/units/apartment/${apartmentId}`);
    const vacantUnits = unitsRes.success ? unitsRes.data.filter(u => u.status === 'vacant') : [];

    if (vacantUnits.length === 0) {
        showToast('No vacant units available in this apartment', 'warning');
        return;
    }

    const formHtml = `
        <p>Current unit: <strong>${tenant.units?.unit_number || 'N/A'}</strong></p>
        <div class="form-group">
            <label class="form-label">Select New Unit</label>
            <select class="form-select" id="new-unit">
                ${vacantUnits.map(u => `<option value="${u.id}">${u.unit_number} - ${capitalize(u.unit_type)} (KES ${u.monthly_rent})</option>`).join('')}
            </select>
        </div>`;

    showFormModal('Change Unit', formHtml, async (overlay) => {
        const newUnitId = overlay.querySelector('#new-unit').value;
        try {
            await apiService.put(`/tenants/${tenant.id}`, { unit_id: newUnitId });
            showToast('Unit changed successfully', 'success');
            location.reload();
        } catch (e) {
            showToast(e.message, 'error');
            return false;
        }
    });
}

// Show Credentials modal
async function showCredentialsModal(tenant) {
    const { showFormModal } = await import('../../components/modal.js');

    const username = tenant.user?.username || 'Unknown';
    const defaultPasswordHint = tenant.phone ? tenant.phone.replace(/\D/g, '').slice(-6) || '123456' : '123456';

    const formHtml = `
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Default Password (last 6 digits of phone):</strong> ${defaultPasswordHint}</p>
        <div class="form-group">
            <label class="form-label">Set New Password (optional)</label>
            <input type="text" class="form-input" id="new-password" placeholder="Leave blank to keep current">
        </div>
        <p class="text-muted">The tenant can also log in with their phone number and the password set here.</p>`;

    showFormModal('Tenant Login Credentials', formHtml, async (overlay) => {
        const newPassword = overlay.querySelector('#new-password').value.trim();
        if (newPassword) {
            try {
                await apiService.put(`/auth/users/${tenant.user_id}`, { password: newPassword });
                showToast(`Password updated! New password: ${newPassword}`, 'success');
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        }
    });
}

// Move Out / Transfer modal
async function openMoveOutModal(tenant) {
    const { showFormModal } = await import('../../components/modal.js');
    const formHtml = `
        <div class="form-group">
            <label class="form-label">Action</label>
            <select class="form-select" id="move-action">
                <option value="move_out">Move Out (End Tenancy)</option>
                <option value="transfer">Transfer to Another Unit</option>
            </select>
        </div>
        <div id="move-out-options">
            <div class="form-group">
                <label class="form-label">Move Out Date</label>
                <input type="date" class="form-input" id="move-out-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
                <label class="form-label">Reason (optional)</label>
                <input type="text" class="form-input" id="move-out-reason" placeholder="Reason for leaving">
            </div>
        </div>
        <div id="transfer-options" style="display:none;">
            <div class="form-group">
                <label class="form-label">Select New Unit</label>
                <select class="form-select" id="transfer-unit">
                    <option value="">Loading…</option>
                </select>
            </div>
        </div>`;

    showFormModal('Move Out / Transfer', formHtml, async (overlay) => {
        const actionSelect = overlay.querySelector('#move-action');
        const moveOutOptions = overlay.querySelector('#move-out-options');
        const transferOptions = overlay.querySelector('#transfer-options');
        const transferUnitSelect = overlay.querySelector('#transfer-unit');

        actionSelect.addEventListener('change', () => {
            if (actionSelect.value === 'move_out') {
                moveOutOptions.style.display = 'block';
                transferOptions.style.display = 'none';
            } else {
                moveOutOptions.style.display = 'none';
                transferOptions.style.display = 'block';
                loadVacantUnits(tenant, transferUnitSelect);
            }
        });

        if (actionSelect.value === 'transfer') {
            loadVacantUnits(tenant, transferUnitSelect);
        }

        if (actionSelect.value === 'move_out') {
            const updates = {
                status: 'moved_out',
                move_out_date: overlay.querySelector('#move-out-date').value,
                move_out_reason: overlay.querySelector('#move-out-reason').value.trim()
            };
            try {
                await apiService.put(`/tenants/${tenant.id}`, updates);
                showToast('Tenant moved out', 'success');
                location.reload();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        } else {
            const newUnitId = transferUnitSelect.value;
            if (!newUnitId) {
                showToast('Please select a unit', 'error');
                return false;
            }
            try {
                await apiService.put(`/tenants/${tenant.id}`, { unit_id: newUnitId });
                showToast('Tenant transferred', 'success');
                location.reload();
            } catch (e) {
                showToast(e.message, 'error');
                return false;
            }
        }
    });
}

async function loadVacantUnits(tenant, selectElement) {
    let apartmentId = tenant.units?.apartment_id;
    if (authService.getRole() === 'caretaker') {
        const aptRes = await apiService.get('/apartments');
        if (aptRes.success && aptRes.data.length > 0) apartmentId = aptRes.data[0].id;
    }
    try {
        const unitsRes = await apiService.get(`/units/apartment/${apartmentId}`);
        const vacantUnits = unitsRes.success ? unitsRes.data.filter(u => u.status === 'vacant') : [];
        if (vacantUnits.length === 0) {
            selectElement.innerHTML = '<option value="">No vacant units</option>';
        } else {
            selectElement.innerHTML = vacantUnits.map(u => `<option value="${u.id}">${u.unit_number} - ${capitalize(u.unit_type)} (KES ${u.monthly_rent})</option>`).join('');
        }
    } catch (e) {
        selectElement.innerHTML = '<option value="">Error loading units</option>';
    }
}
