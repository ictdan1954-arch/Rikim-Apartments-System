import { authService } from '../services/auth.service.js';
import { router } from '../router.js';
import { showToast } from '../components/toast.js';

export default async function loginPage(container) {
    container.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-logo">
                    <i class="fas fa-building"></i>
                    <h1>Bandaptai Apartments</h1>
                    <p>Management System</p>
                </div>
                <form id="login-form" class="auth-form">
                    <div class="form-group">
                        <label class="form-label">Phone Number or Email</label>
                        <input type="text" class="form-input" id="login-phone" 
                               placeholder="Enter phone or email" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-input" id="login-password" 
                               placeholder="Enter password" required>
                    </div>
                    <div id="login-error" class="form-error" style="display:none;"></div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width:100%;">
                        <i class="fas fa-sign-in-alt"></i> Sign In
                    </button>
                </form>
                <div class="auth-footer">
                    <p>First time? <a href="#/setup">Set up system</a></p>
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

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('login-phone').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        
        try {
            errorEl.style.display = 'none';
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;"></span> Signing in...';

            const response = await authService.login(phone, password);
            
            if (response.success) {
                showToast('Welcome back!', 'success');
                const role = authService.getRole();
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
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    });
}
