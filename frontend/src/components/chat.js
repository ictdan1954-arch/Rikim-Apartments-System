import { apiService } from '../services/api.service.js';
import { formatDateTime } from '../utils/formatters.js';
import { showToast } from './toast.js';

export function openChatModal(currentUserId, partnerId, partnerName, apartmentId = null) {
    const { showFormModal } = await import('./modal.js');
    
    // Fetch previous messages
    let messagesHtml = '<p class="text-muted">Loading messages...</p>';
    try {
        const res = await apiService.get(`/messages/${partnerId}`);
        if (res.success) {
            const messages = res.data;
            messagesHtml = messages.map(m => {
                const isMine = m.sender_id === currentUserId;
                return `
                <div style="margin-bottom:8px; text-align:${isMine ? 'right' : 'left'};">
                    <div style="display:inline-block; max-width:80%; padding:8px 12px; border-radius:12px; background:${isMine ? 'var(--primary-bg)' : 'var(--bg-input)'};">
                        <p style="margin:0;">${m.message}</p>
                        <small class="text-muted">${formatDateTime(m.created_at)} ${isMine ? `<button class="delete-msg-btn" data-id="${m.id}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.8rem;"><i class="fas fa-trash"></i></button>` : ''}</small>
                    </div>
                </div>`;
            }).join('');
        }
    } catch (e) {
        messagesHtml = '<p class="text-muted">Could not load messages.</p>';
    }

    const formHtml = `
        <div class="chat-container" style="max-height:400px; overflow-y:auto; padding:8px;" id="chat-messages">
            ${messagesHtml}
        </div>
        <div class="mt-2" style="display:flex; gap:8px;">
            <input type="text" class="form-input" id="chat-input" placeholder="Type a message..." style="flex:1;">
            <button class="btn btn-primary" id="send-chat-btn"><i class="fas fa-paper-plane"></i></button>
        </div>`;

    const modal = await showFormModal(`Chat with ${partnerName}`, formHtml, null);
    // We need to manually handle send because the modal's confirm button is not used here.
    // Instead, we'll add event listeners directly.

    const overlay = document.querySelector('.modal-overlay'); // get the last modal
    const chatContainer = overlay.querySelector('#chat-messages');
    const chatInput = overlay.querySelector('#chat-input');
    const sendBtn = overlay.querySelector('#send-chat-btn');

    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        try {
            await apiService.post('/messages', {
                receiver_id: partnerId,
                apartment_id: apartmentId,
                message
            });
            chatInput.value = '';
            // Refresh messages
            const res = await apiService.get(`/messages/${partnerId}`);
            if (res.success) {
                chatContainer.innerHTML = res.data.map(m => {
                    const isMine = m.sender_id === currentUserId;
                    return `
                    <div style="margin-bottom:8px; text-align:${isMine ? 'right' : 'left'};">
                        <div style="display:inline-block; max-width:80%; padding:8px 12px; border-radius:12px; background:${isMine ? 'var(--primary-bg)' : 'var(--bg-input)'};">
                            <p style="margin:0;">${m.message}</p>
                            <small class="text-muted">${formatDateTime(m.created_at)} ${isMine ? `<button class="delete-msg-btn" data-id="${m.id}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.8rem;"><i class="fas fa-trash"></i></button>` : ''}</small>
                        </div>
                    </div>`;
                }).join('');
                // Attach delete listeners
                attachDeleteListeners(chatContainer, currentUserId);
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Delete message handler
    function attachDeleteListeners(container, userId) {
        container.querySelectorAll('.delete-msg-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const msgId = btn.dataset.id;
                try {
                    await apiService.delete(`/messages/${msgId}`);
                    // Remove from DOM
                    btn.closest('div[style*="margin-bottom"]').remove();
                } catch (e) {
                    showToast(e.message, 'error');
                }
            });
        });
    }

    // Initial attach
    attachDeleteListeners(chatContainer, currentUserId);
}
