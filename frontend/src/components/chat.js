import { apiService } from '../services/api.service.js';
import { formatDateTime } from '../utils/formatters.js';
import { showToast } from './toast.js';

export async function openChatModal(currentUserId, partnerId, partnerName, apartmentId = null) {
    // Fetch previous messages
    let messagesHtml = '<p class="text-muted">Loading messages...</p>';
    try {
        const res = await apiService.get(`/messages/${partnerId}`);
        if (res.success) {
            const messages = res.data;
            if (messages.length === 0) {
                messagesHtml = '<p class="text-muted">No messages yet. Start the conversation!</p>';
            } else {
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

    // Import showFormModal dynamically
    const { showFormModal } = await import('./modal.js');
    showFormModal(`Chat with ${partnerName}`, formHtml, null);

    // Wait for the modal to appear in the DOM (it's rendered synchronously after we call showFormModal)
    // We'll use a small delay to ensure the DOM is ready
    await new Promise(resolve => setTimeout(resolve, 200));

    const overlay = document.querySelector('.modal-overlay');
    if (!overlay) {
        console.error('Chat modal not found');
        return;
    }

    const chatContainer = overlay.querySelector('#chat-messages');
    const chatInput = overlay.querySelector('#chat-input');
    const sendBtn = overlay.querySelector('#send-chat-btn');

    if (!chatContainer || !chatInput || !sendBtn) {
        console.error('Chat elements missing');
        return;
    }

    // Helper function to refresh messages
    async function refreshMessages() {
        try {
            const res = await apiService.get(`/messages/${partnerId}`);
            if (res.success) {
                const messages = res.data;
                chatContainer.innerHTML = messages.length === 0
                    ? '<p class="text-muted">No messages yet.</p>'
                    : messages.map(m => {
                        const isMine = m.sender_id === currentUserId;
                        return `
                        <div style="margin-bottom:8px; text-align:${isMine ? 'right' : 'left'};">
                            <div style="display:inline-block; max-width:80%; padding:8px 12px; border-radius:12px; background:${isMine ? 'var(--primary-bg)' : 'var(--bg-input)'};">
                                <p style="margin:0;">${m.message}</p>
                                <small class="text-muted">${formatDateTime(m.created_at)} ${isMine ? `<button class="delete-msg-btn" data-id="${m.id}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:0.8rem;"><i class="fas fa-trash"></i></button>` : ''}</small>
                            </div>
                        </div>`;
                    }).join('');
                // Re-attach delete listeners
                attachDeleteListeners(chatContainer);
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

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
            await refreshMessages();
        } catch (e) {
            showToast(e.message, 'error');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Delete message handler
    function attachDeleteListeners(container) {
        container.querySelectorAll('.delete-msg-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const msgId = btn.dataset.id;
                try {
                    await apiService.delete(`/messages/${msgId}`);
                    // Remove from DOM
                    const msgDiv = btn.closest('div[style*="margin-bottom"]');
                    if (msgDiv) msgDiv.remove();
                } catch (e) {
                    showToast(e.message, 'error');
                }
            });
        });
    }

    // Initial attach of delete listeners
    attachDeleteListeners(chatContainer);
}
