import { apiService } from '../services/api.service.js';
import { authService } from '../services/auth.service.js';
import { showToast } from './toast.js';

export async function openProfileModal() {
    const user = authService.user;
    if (!user) return;

    const { showFormModal } = await import('./modal.js');
    const formHtml = `
        <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" class="form-input" id="profile-username" value="${user.username || ''}" placeholder="Enter username">
        </div>
        <div class="form-group">
            <label class="form-label">New Password (leave blank to keep current)</label>
            <input type="password" class="form-input" id="profile-password" placeholder="Min 6 characters">
        </div>
        <div class="form-group">
            <label class="form-label">Profile Photo</label>
            <input type="file" class="form-input" id="profile-photo" accept="image/*">
            <small class="text-muted">Optional. Max 5MB.</small>
        </div>
        ${user.profile_photo ? `<img src="${user.profile_photo}" alt="Current photo" style="width:80px; border-radius:50%; margin-top:8px;">` : ''}
    `;

    showFormModal('Edit Profile', formHtml, async (overlay) => {
        const username = overlay.querySelector('#profile-username').value.trim();
        const password = overlay.querySelector('#profile-password').value;
        const photoFile = overlay.querySelector('#profile-photo').files[0];

        const body = {};
        if (username && username !== user.username) body.username = username;
        if (password) body.password = password;

        try {
            // Upload photo if selected
            if (photoFile) {
                const formData = new FormData();
                formData.append('photo', photoFile);
                const uploadRes = await apiService.uploadFile('/upload/profile-photo', photoFile);
                if (uploadRes.success) {
                    body.profile_photo = uploadRes.data.url;
                } else {
                    showToast('Photo upload failed', 'error');
                    return false;
                }
            }

            // Update profile
            if (Object.keys(body).length > 0) {
                const res = await apiService.put('/auth/profile', body);
                if (res.success) {
                    // Update local user data
                    authService.user = { ...authService.user, ...res.data };
                    localStorage.setItem('bandaptai_user', JSON.stringify(authService.user));
                    showToast('Profile updated', 'success');
                    // Refresh sidebar info
                    updateSidebarUserInfo();
                }
            } else if (photoFile) {
                // Already uploaded photo but no other changes – reload to reflect photo
                const updatedUser = await apiService.get('/auth/profile');
                if (updatedUser.success) {
                    authService.user = updatedUser.data;
                    localStorage.setItem('bandaptai_user', JSON.stringify(authService.user));
                    updateSidebarUserInfo();
                }
                showToast('Profile photo updated', 'success');
            } else {
                showToast('No changes made', 'warning');
            }
        } catch (e) {
            showToast(e.message, 'error');
            return false;
        }
    });
}

function updateSidebarUserInfo() {
    const user = authService.user;
    if (!user) return;
    const userNameEl = document.getElementById('user-name');
    const userRoleEl = document.getElementById('user-role');
    const userAvatarEl = document.getElementById('user-avatar');
    if (userNameEl) userNameEl.textContent = user.full_name;
    if (userRoleEl) userRoleEl.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    if (userAvatarEl) {
        if (user.profile_photo) {
            userAvatarEl.src = user.profile_photo;
            userAvatarEl.style.display = 'block';
        } else {
            userAvatarEl.src = 'assets/images/default-avatar.png'; // fallback
        }
    }
}
