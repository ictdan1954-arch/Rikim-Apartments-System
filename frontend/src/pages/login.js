import { authService } from '../services/auth.service.js';
import { router } from '../router.js';
import { showToast } from '../components/toast.js';
import { setupSidebar } from '../components/sidebar.js';

export default async function loginPage() {
    console.log('✅ loginPage loaded!');

    const app = document.getElementById('app');
    if (app) app.style.display = 'none';

    const existing = document.getElementById('login-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'login-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 58, 95, 0.6), rgba(37, 99, 235, 0.4)),
                    url('assets/images/login-splash01.jpg');
        background-size: cover;
        background-position: center;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
        max-width: 420px;
        width: 100%;
        background: rgba(255,255,255,0.96);
        backdrop-filter: blur(16px);
        border-radius: 24px;
        padding: 40px 32px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.3);
    `;

    card.innerHTML = `
        <div style="text-align:center; margin-bottom:28px;">
            <img src="assets/images/logo.png" alt="Rikim Apartments" style="max-height:80px; margin-bottom:12px;">
            <h1 style="font-size:1.6rem; font-weight:800; color:#1e293b; margin:0;">Rikim Apartments</h1>
            <p style="color:#64748b; font-size:0.9rem; margin-top:4px;">Management System</p>
        </div>
        <form id="login-form">
            <div style="margin-bottom:18px;">
                <label style="display:block; font-weight:600; font-size:0.85rem; color:#1e293b; margin-bottom:4px;">Phone, Email or Username</label>
                <div style="position:relative;">
                    <i class="fas fa-user" style="position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#94a3b8;"></i>
                    <input type="text" id="login-identifier" 
                           style="width:100%; padding:12px 12px 12px 40px; border:2px solid #e2e8f0; border-radius:10px; font-size:1rem; outline:none; box-sizing:border-box;"
                           placeholder="Enter phone, email or username" required autocomplete="username">
                </div>
            </div>
            <div style="margin-bottom:20px;">
                <label style="display:block; font-weight:600; font-size:0.85rem; color:#1e293b; margin-bottom:4px;">Password</label>
                <div style="position:relative;">
                    <i class="fas fa-lock" style="position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#94a3b8;"></i>
                    <input type="password" id="login-password" 
                           style="width:100%; padding:12px 12px 12px 40px; border:2px solid #e2e8f0; border-radius:10px; font-size:1rem; outline:none; box-sizing:border-box;"
                           placeholder="Enter password" required autocomplete="current-password">
                    <button type="button" id="toggle-password" 
                            style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:#94a3b8; cursor:pointer; padding:4px 8px;">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <div id="login-error" style="display:none; background:#fef2f2; color:#dc2626; padding:8px 12px; border-radius:8px; margin-bottom:12px; font-size:0.9rem;"></div>
            <button type="submit" style="width:100%; padding:14px; background:#5E7A8E; color:white; border:none; border-radius:12px; font-size:1rem; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:background 0.2s;"
                    onmouseover="this.style.background='#A84A3A'" onmouseout="this.style.background='#5E7A8E'">
                <i class="fas fa-sign-in-alt"></i> Sign In
            </button>
            <div style="text-align:center; margin-top:20px; color:#94a3b8; font-size:0.8rem;">
                <a href="#" id="forgot-password-link" style="color:#5E7A8E; text-decoration:none;">Forgot Password?</a>
                <p style="margin-top:8px;">&copy; ${new Date().getFullYear()} Rikim Apartments</p>
            </div>
        </form>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Toggle password visibility
    overlay.querySelector('#toggle-password')?.addEventListener('click', function() {
        const pwd = overlay.querySelector('#login-password');
        const icon = this.querySelector('i');
        pwd.type = pwd.type === 'password' ? 'text' : 'password';
        icon.className = pwd.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });

    // Forgot password
    overlay.querySelector('#forgot-password-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        showToast('Please contact your landlord or caretaker to reset your password.', 'info');
    });

    // Login form submit
    overlay.querySelector('#login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = overlay.querySelector('#login-identifier').value.trim();
        const password = overlay.querySelector('#login-password').value;
        const errorEl = overlay.querySelector('#login-error');
        if (errorEl) errorEl.style.display = 'none';

        const btn = overlay.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Signing in...';

        try {
            const response = await authService.login(identifier, password);
            if (response.success) {
                showToast('Welcome back!', 'success');
                overlay.remove();
                if (app) app.style.display = '';
                router.navigateByRole();
                setupSidebar().catch(err => console.error('Sidebar setup error:', err));
            } else {
                throw new Error(response.message || 'Login failed');
            }
        } catch (error) {
            if (errorEl) {
                errorEl.textContent = error.message;
                errorEl.style.display = 'block';
            }
            showToast(error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        }
    });

    // Spinner animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
            display: inline-block;
            width: 20px; height: 20px;
            border: 3px solid #fff;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
    `;
    document.head.appendChild(style);
}
