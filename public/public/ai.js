// AI Assistant JavaScript

async function sendQuery() {
  const input = document.getElementById('query-input');
  const query = input.value.trim();
  if (!query) return;
  
  const messagesDiv = document.getElementById('chat-messages');
  const responseCard = document.getElementById('response-card');
  const responseContent = document.getElementById('response-content');
  
  // Add user message
  const userMsg = document.createElement('div');
  userMsg.className = 'message user';
  userMsg.innerHTML = `<div class="message-bubble">${escapeHtml(query)}</div>`;
  messagesDiv.appendChild(userMsg);
  
  input.value = '';
  scrollToBottom();
  
  // Show typing indicator
  const typing = document.createElement('div');
  typing.className = 'message bot';
  typing.id = 'typing-indicator';
  typing.innerHTML = `
    <div class="message-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  messagesDiv.appendChild(typing);
  scrollToBottom();
  
  try {
    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const data = await response.json();
    document.getElementById('typing-indicator').remove();
    
    if (data.success && data.data) {
      // Format and display in chat
      const botMsg = document.createElement('div');
      botMsg.className = 'message bot';
      botMsg.innerHTML = formatResponse(data.data, true);
      messagesDiv.appendChild(botMsg);
      
      // Also show in response card
      responseContent.innerHTML = formatResponse(data.data, false);
      responseCard.style.display = 'block';
    }
    
    scrollToBottom();
  } catch (error) {
    document.getElementById('typing-indicator').remove();
    const errorMsg = document.createElement('div');
    errorMsg.className = 'message bot';
    errorMsg.innerHTML = `<div class="message-bubble">Sorry, an error occurred. Please try again.</div>`;
    messagesDiv.appendChild(errorMsg);
    scrollToBottom();
  }
}

function formatResponse(data, inChat = false) {
  if (inChat) {
    // Compact format for chat bubble
    return `<div class="message-bubble ai-formatted">
      <div class="ai-response-card">
        ${formatResponseContent(data, true)}
      </div>
    </div>`;
  } else {
    // Full format for response card
    return `<div class="ai-response-card">
      ${formatResponseContent(data, false)}
    </div>`;
  }
}

function formatResponseContent(data, compact = false) {
  let html = '';
  
  // Summary
  if (data.summary) {
    html += `<div class="ai-summary">${escapeHtml(data.summary)}</div>`;
  }
  
  // Documents Required
  if (data.documents && data.documents.length > 0) {
    html += `<div class="ai-response-section">
      <div class="ai-section-header">📄 Documents Required</div>
      <div class="ai-section-content">
        <ul class="ai-list">
          ${data.documents.map(doc => `<li>${escapeHtml(doc)}</li>`).join('')}
        </ul>
      </div>
    </div>`;
  }
  
  // Fees
  if (data.fees) {
    html += `<div class="ai-response-section">
      <div class="ai-section-header">💰 Fees</div>
      <div class="ai-section-content">
        <p><strong>${escapeHtml(data.fees)}</strong></p>
      </div>
    </div>`;
  }
  
  // Steps
  if (data.steps && data.steps.length > 0) {
    html += `<div class="ai-response-section">
      <div class="ai-section-header">📋 Steps</div>
      <div class="ai-section-content">
        <ol class="ai-list">
          ${data.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
        </ol>
      </div>
    </div>`;
  }
  
  // Timeline
  if (data.timeline) {
    html += `<div class="ai-response-section">
      <div class="ai-section-header">⏱️ Timeline</div>
      <div class="ai-section-content">
        <p><strong>${escapeHtml(data.timeline)}</strong></p>
      </div>
    </div>`;
  }
  
  // Availability (Online/Offline)
  if (data.online || data.offline) {
    html += `<div class="ai-response-section">
      <div class="ai-section-header">🌐 Availability</div>
      <div class="ai-section-content">
        <div class="ai-grid">
          ${data.online ? `<div class="ai-grid-item"><strong>Online:</strong> ${escapeHtml(data.online)}</div>` : ''}
          ${data.offline ? `<div class="ai-grid-item"><strong>Offline:</strong> ${escapeHtml(data.offline)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }
  
  // Tips
  if (data.tips && data.tips.length > 0) {
    html += `<div class="ai-response-section">
      <div class="ai-section-header">💡 Tips</div>
      <div class="ai-section-content">
        <ul class="ai-list">
          ${data.tips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}
        </ul>
      </div>
    </div>`;
  }
  
  // Sources
  if (data.sources && data.sources.length > 0) {
    html += `<div class="ai-response-section">
      <div class="ai-section-header">📚 Sources</div>
      <div class="ai-section-content">
        <ul class="ai-list">
          ${data.sources.map(source => `<li>${escapeHtml(source)}</li>`).join('')}
        </ul>
      </div>
    </div>`;
  }
  
  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  const messagesDiv = document.getElementById('chat-messages');
  setTimeout(() => {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 100);
}

