import { apiService } from '../../services/api.service.js';
import { authService } from '../../services/auth.service.js';
import { showToast } from '../../components/toast.js';
import { router } from '../../router.js';
import { capitalize } from '../../utils/formatters.js';

export default async function registerTenant(container) {
    const role = authService.getRole();

    let apartments = [];
    let defaultAptId = null;
    let defaultAptName = '';

    if (role === 'caretaker') {
        // Fetch caretaker's assigned apartments (should be one)
        const res = await apiService.get('/apartments');
        if (res.success && res.data.length > 0) {
            defaultAptId = res.data[0].id;
            defaultAptName = res.data[0].name;
            apartments = res.data; // still needed for the dropdown?
        }
    } else {
        // Landlord sees all apartments
        const res = await apiService.get('/apartments');
        apartments = res.success ? res.data : [];
    }

    container.innerHTML = `
        <div class="card" style="max-width: 700px; margin: 0 auto;">
            <div class="card-header">
                <h3 class="card-title">Register New Tenant</h3>
            </div>
            <form id="tenant-form">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="form-group">
                        <label class="form-label">Full Name <span class="required">*</span></label>
                        <input type="text" class="form-input" id="t-name" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phone Number <span class="required">*</span></label>
                        <input type="text" class="form-input" id="t-phone" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" id="t-email">
                    </div>
                    <div class="form-group">
                        <label class="form-label">ID Number</label>
                        <input type="text" class="form-input" id="t-idnumber">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Apartment <span class="required">*</span></label>
                        <select class="form-select" id="t-apartment" ${role === 'caretaker' ? 'disabled' : ''}>
                            ${role === 'caretaker' 
                                ? `<option value="${defaultAptId}" selected>${defaultAptName}</option>`
                                : `<option value="">Select apartment</option>` + apartments.map(a => `<option value="${a.id}">${a.name}</option>`).join('')
                            }
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Unit <span class="required">*</span></label>
                        <select class="form-select" id="t-unit" required ${role === 'caretaker' ? '' : 'disabled'}>
                            ${role === 'caretaker' 
                                ? `<option value="">Select unit</option>` // will be populated immediately
                                : `<option value="">Select apartment first</option>`}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Lease Start Date</label>
                        <input type="date" class="form-input" id="t-start" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Deposit Paid (KES)</label>
                        <input type="number" class="form-input" id="t-deposit" value="0" min="0">
                    </div>
                </div>
                <div class="mt-2" style="display:flex; gap:12px; justify-content:flex-end;">
                    <button type="button" class="btn btn-secondary" onclick="window.router.navigate('/tenants')">Cancel</button>
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Register Tenant</button>
                </div>
            </form>
        </div>`;

    // Load units for the initially selected apartment (caretaker's or landlord's first)
    const selectedAptId = role === 'caretaker' ? defaultAptId : null;
    if (selectedAptId) {
        loadUnits(selectedAptId);
    } else if (role === 'landlord') {
        // For landlord, enable the apartment dropdown to load units on change
        const aptSelect = document.getElementById('t-apartment');
        aptSelect.disabled = false;
        aptSelect.addEventListener('change', (e) => {
            const aptId = e.target.value;
            if (aptId) loadUnits(aptId);
            else resetUnitSelect();
        });
    }

    async function loadUnits(apartmentId) {
        const unitSelect = document.getElementById('t-unit');
        unitSelect.disabled = true;
        unitSelect.innerHTML = '<option>Loading…</option>';
        try {
            const response = await apiService.get(`/units/apartment/${apartmentId}`);
            if (response.success) {
                const vacantUnits = response.data.filter(u => u.status === 'vacant');
                if (vacantUnits.length === 0) {
                    unitSelect.innerHTML = '<option value="">No vacant units</option>';
                } else {
                    unitSelect.innerHTML = '<option value="">Select unit</option>' + 
                        vacantUnits.map(u => `<option value="${u.id}">${u.unit_number} - ${capitalize(u.unit_type)} (KES ${u.monthly_rent})</option>`).join('');
                }
            } else {
                unitSelect.innerHTML = '<option value="">Error loading units</option>';
            }
        } catch (e) {
            unitSelect.innerHTML = '<option value="">Error loading units</option>';
        }
        unitSelect.disabled = false;
    }

    function resetUnitSelect() {
        const unitSelect = document.getElementById('t-unit');
        unitSelect.innerHTML = '<option value="">Select apartment first</option>';
        unitSelect.disabled = true;
    }

    document.getElementById('tenant-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            full_name: document.getElementById('t-name').value.trim(),
            phone: document.getElementById('t-phone').value.trim(),
            email: document.getElementById('t-email').value.trim(),
            id_number: document.getElementById('t-idnumber').value.trim(),
            unit_id: document.getElementById('t-unit').value,
            lease_start_date: document.getElementById('t-start').value,
            deposit_paid: parseFloat(document.getElementById('t-deposit').value) || 0
        };

        if (!data.full_name || !data.phone || !data.unit_id) {
            showToast('Fill all required fields', 'error');
            return;
        }

        try {
            const response = await apiService.post('/tenants', data);
            const { username, default_password } = response.data;
            showToast(`Tenant registered! Username: ${username} | Password: ${default_password}`, 'success');
            router.navigate('/tenants');
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
}
