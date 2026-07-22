import { authService } from '../services/auth.service.js';
import { router } from '../router.js';
import { showToast } from '../components/toast.js';

export default async function loginPage(container) {
    console.log('✅ loginPage loaded!'); // <-- Check console for this

    // Clear container and force it to be visible
    container.innerHTML = '';
    container.style.cssText = `
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 100vh !important;
        width: 100% !important;
        padding: 20px !important;
        margin: 0 !important;
        background: transparent !important;
        position: relative !important;
        z-index: 1000 !important;
    `;

    // Build the login form with inline styles (no external CSS conflicts)
    container.innerHTML = `
        <div style="
            width: 100%;
            max-width: 420px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(16px);
            border-radius: 24px;
            padding: 40px 32px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.3);
            position: relative;
            z-index: 10;
        ">
            <div style="text-align: center; margin-bottom: 28px;">
                <img src="assets/images/logo.png" alt="Rikim Apartments" style="max-height:80px; margin-bottom:12px;">
                <h1 style="font-size: 1.6rem; font-weight: 800; color: #1e293b; margin: 0; letter-spacing: -0.5px;">Rikim Apartments</h1>
                <p style="color: #64748b; font-size: 0.9rem; margin-top: 4px;">Management System</p>
            </div>

            <form id="login-form">
                <div style="margin-bottom: 18px;">
                    <label style="display: block; font-weight: 600; font-size: 0.85rem; color: #1e293b; margin-bottom: 4px;">Phone, Email or Username</label>
                    <div style="position: relative;">
                        <i class="fas fa-user" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                        <input type="text" id="login-identifier" 
                               style="width: 100%; padding: 12px 12px 12px 40px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 1rem; outline: none; transition: border 0.2s; box-sizing: border-box;"
                               placeholder="Enter phone, email or username" required autocomplete="username">
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; font-weight: 600; font-size: 0.85rem; color: #1e293b; margin-bottom: 4px;">Password</label>
                    <div style="position: relative;">
                        <i class="fas fa-lock" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8;"></i>
                        <input type="password" id="login-password" 
                               style="width: 100%; padding: 12px 12px 12px 40px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 1rem; outline: none; transition: border 0.2s; box-sizing: border-box;"
                               placeholder="Enter password" required autocomplete="current-password">
                        <button type="button" id="toggle-password" 
                                style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px 8px;">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>

                <div id="login-error" style="display: none; background: #fef2f2; color: #dc2626; padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 0.9rem;"></div>

                <button type="submit" style="
                    width: 100%;
                    padding: 14px;
                    background: #5E7A8E;
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s, transform 0.1s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                " onmouseover="this.style.background='#A84A3A'" onmouseout="this.style.background='#5E7A8E'">
                    <i class="fas fa-sign-in-alt"></i> Sign In
                </button>

                <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 0.8rem;">
                    <a href="#" id="forgot-password-link" style="color: #5E7A8E; text-decoration: none;">Forgot Password?</a>
                    <p style="margin-top: 8px;">&copy; ${new Date().getFullYear()} Rikim Apartments</p>
                </div>
            </form>
        </div>
    `;

    // ---- Add background overlay (optional) ----
    // You can also add a background image to the body if needed.
    // But the container already has a semi-transparent card.

    // ---- Event listeners ----
    // Toggle password
    const toggleBtn = document.getElementById('toggle-password');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function() {
            const pwd = document.getElementById('login-password');
            const icon = this.querySelector('i');
            if (pwd.type === 'password') {
                pwd.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                pwd.type = 'password';
                icon.className = 'fas fa-eye';
            }
        });
    }

    // Forgot password
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Please contact your landlord or caretaker to reset your password.', 'info');
        });
    }

    // Form submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = document.getElementById('login-identifier').value.trim();
            const password = document.getElementById('login-password').value;
            const errorEl = document.getElementById('login-error');
            if (errorEl) errorEl.style.display = 'none';

            try {
                const btn = e.target.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = '<span style="display:inline-block; width:20px; height:20px; border:3px solid #fff; border-top-color: transparent; border-radius:50%; animation: spin 0.8s linear infinite;"></span> Signing in...';

                const response = await authService.login(identifier, password);
                if (response.success) {
                    showToast('Welcome back!', 'success');
                    router.navigateByRole();
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
                const btn = e.target.querySelector('button[type="submit"]');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
            }
        });
    }

    // Add a simple spin animation for the button spinner
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}
