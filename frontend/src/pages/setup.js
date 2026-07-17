import { authService } from '../services/auth.service.js';
import { router } from '../router.js';
import { showToast } from '../components/toast.js';

export default async function setupPage(container) {
    // Check if system already set up
    try {
        const checkResponse = await fetch(`${window.API_BASE_URL || 'http://localhost:3000/api'}/auth/check-setup`);
        const checkData = await checkResponse.json();
        if (checkData.data?.hasLandlord) {
            router.navigate('/login');
            return;
        }
    } catch (e) {}

    container.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-logo">
                    <i class="fas fa-building"></i>
                    <h1>Bandaptai Apartments</h1>
                    <p>Initial System Setup</p>
                </div>
                <form id="setup-form" class="auth-form">
                    <div class="form-group">
                        <label class="form-label">Full Name <span class="required">*</span></label>
                        <input type="text" class="form-input" id="setup-name" 
                               placeholder="Landlord full name" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Phone Number <span class="required">*</span></label>
                        <input type="text" class="form-input" id="setup-phone" 
                               placeholder="+254..." required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password <span class="required">*</span></label>
                        <input type="password" class="form-input" id="setup-password" 
                               placeholder="Min 6 characters" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm Password <span class="required">*</span></label>
                        <input type="password" class="form-input" id="setup-confirm-password" 
                               placeholder="Confirm password" required>
                    </div>
                    <div id="setup-error" class="form-error" style="display:none;"></div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width:100%;">
                        <i class="fas fa-cog"></i> Create Admin Account
                    </button>
                </form>
                <div class="auth-footer">
                    <p>Already set up? <a href="#/login">Sign in</a></p>
                </div>
            </div>
        </div>
        <style>
            .auth-container {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #1e3a5f 0%, #2563EB 100%);
                padding: 20px;
            }
            .auth-card {
                background: white;
                border-radius: 20px;
                padding: 40px;
                width: 100%;
                max-width: 420px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: slideUp 0.5s ease;
            }
            .auth-logo {
                text-align: center;
                margin-bottom: 32px;
            }
            .auth-logo i {
                font-size: 3rem;
                color: var(--primary);
                margin-bottom: 12px;
            }
            .auth-logo h1 {
                font-size: 1.5rem;
                font-weight: 800;
                color: var(--text-primary);
            }
            .auth-logo p {
                color: var(--text-secondary);
                font-size: 0.9rem;
            }
            .auth-footer {
                text-align: center;
                margin-top: 20px;
                font-size: 0.9rem;
                color: var(--text-secondary);
            }
        </style>
    `;

    document.getElementById('setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('setup-name').value;
        const phone = document.getElementById('setup-phone').value;
        const password = document.getElementById('setup-password').value;
        const confirmPassword = document.getElementById('setup-confirm-password').value;
        const errorEl = document.getElementById('setup-error');

        errorEl.style.display = 'none';

        if (password.length < 6) {
            errorEl.textContent = 'Password must be at least 6 characters';
            errorEl.style.display = 'block';
            return;
        }

        if (password !== confirmPassword) {
            errorEl.textContent = 'Passwords do not match';
            errorEl.style.display = 'block';
            return;
        }

        try {
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;"></span> Setting up...';

            const response = await authService.setup(name, phone, password);
            
            if (response.success) {
                showToast('System setup complete! Welcome!', 'success');
                router.navigate('/dashboard');
                window.location.reload();
            }
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.style.display = 'block';
            showToast(error.message, 'error');
        } finally {
            const btn = e.target.querySelector('button');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-cog"></i> Create Admin Account';
        }
    });
}
