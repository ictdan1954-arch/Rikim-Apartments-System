import { apiService } from '../services/api.service.js';
import { authService } from '../services/auth.service.js';

export function setupNotifications() {
    const bell = document.getElementById('notification-bell');
    const countBadge = document.getElementById('notification-count');
    
    bell.addEventListener('click', () => {
        toggleDropdown();
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!bell.contains(e.target)) {
            const dropdown = document.querySelector('.notification-dropdown');
            if (dropdown) dropdown.classList.remove('open');
        }
    });

    // Fetch notifications periodically
    if (authService.isAuthenticated()) {
        fetchNotifications();
        setInterval(fetchNotifications, 60000); // Every minute
    }
}

async function fetchNotifications() {
    try {
        const response = await apiService.get('/notifications');
        if (response.success) {
            const unreadCount = response.data.filter(n => !n.is_read).length;
            updateBadge(unreadCount);
        }
    } catch (error) {
        // Silently fail
    }
}

function updateBadge(count) {
    const badge = document.getElementById('notification-count');
    if (count > 0) {
        badge.textContent = count;
        badge.classList.add('has-notifications');
    } else {
        badge.textContent = '0';
        badge.classList.remove('has-notifications');
    }
}

async function toggleDropdown() {
    let dropdown = document.querySelector('.notification-dropdown');
    
    if (dropdown) {
        dropdown.classList.toggle('open');
        if (dropdown.classList.contains('open')) {
            await loadNotifications(dropdown);
        }
        return;
    }

    // Create dropdown
    dropdown = document.createElement('div');
    dropdown.className = 'notification-dropdown open';
    dropdown.innerHTML = `
        <div class="notification-dropdown-header">
            <span>Notifications</span>
            <button class="btn btn-sm btn-outline mark-all-read">Mark all read</button>
        </div>
        <div class="notification-list">
            <div class="spinner" style="margin: 40px auto;"></div>
        </div>
    `;

    document.querySelector('.notification-bell').parentElement.appendChild(dropdown);
    await loadNotifications(dropdown);

    dropdown.querySelector('.mark-all-read')?.addEventListener('click', async () => {
        try {
            await apiService.put('/notifications/mark-all-read');
            dropdown.querySelector('.notification-list').innerHTML = 
                '<p class="text-center text-muted" style="padding: 40px;">No new notifications</p>';
            updateBadge(0);
        } catch (error) {
            // ignore
        }
    });
}

async function loadNotifications(dropdown) {
    try {
        const response = await apiService.get('/notifications');
        if (response.success && response.data.length > 0) {
            dropdown.querySelector('.notification-list').innerHTML = response.data.map(n => `
                <div class="notification-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
                    <div class="notification-item-icon" style="background: var(--primary-bg); color: var(--primary);">
                        <i class="fas fa-bell"></i>
                    </div>
                    <div class="notification-item-content">
                        <div class="notification-item-title">${n.title}</div>
                        <div class="notification-item-message">${n.message}</div>
                        <div class="notification-item-time">${timeAgo(n.created_at)}</div>
                    </div>
                </div>
            `).join('');

            // Click to mark as read
            dropdown.querySelectorAll('.notification-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const id = item.dataset.id;
                    await apiService.put(`/notifications/${id}/read`);
                    item.classList.remove('unread');
                });
            });
        } else {
            dropdown.querySelector('.notification-list').innerHTML = 
                '<p class="text-center text-muted" style="padding: 40px;">No notifications yet</p>';
        }
    } catch (error) {
        dropdown.querySelector('.notification-list').innerHTML = 
            '<p class="text-center text-muted" style="padding: 40px;">Failed to load notifications</p>';
    }
}

function timeAgo(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}
