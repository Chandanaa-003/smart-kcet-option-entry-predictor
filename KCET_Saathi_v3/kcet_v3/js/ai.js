/*
  ════════════════════════════════════════
  ai.js  —  AI Counsellor
  ════════════════════════════════════════

  WHAT THIS FILE DOES:
  - Lets students chat with Claude AI about KCET option entry strategy
  - Sends the student's rank, category, and top safe colleges as context
    so the AI gives personalised answers (not generic ones)
  - Saves the API key in localStorage so the student doesn't re-enter it

  HOW THE API CALL WORKS:
  1. Student types a question
  2. We build a "system prompt" that tells Claude:
     - who it is (KCET counsellor)
     - the student's rank and category
     - the student's top safe colleges
  3. We send that + the question to api.anthropic.com/v1/messages
  4. Claude replies, we show it as a chat bubble

  IMPORTANT — API KEY SECURITY:
  The API key is stored in the browser's localStorage.
  This is fine for a hackathon / demo. In a real product,
  the key should be on a backend server, never in the browser.

  DEPENDENCIES:
  - window.Predictor.getResults() (from predictor.js)
  - DOM elements: #chatMessages, #chatInput, #sendBtn, #apiBox, #apiKeyInput
*/

window.AI = (function () {

  // ── state ──
// ── state ──
let isBusy     = false;   // true while waiting for AI response
let history    = [];      // conversation history (for multi-turn chat)


  // ══════════════════════════════════════
  // sendQ(el)
  // Called when a quick-question chip is clicked.
  // Puts the chip text into the input and sends it.
  // ══════════════════════════════════════
  function sendQ(el) {
    document.getElementById('chatInput').value = el.textContent.trim();
    sendMsg();
  }


  // ══════════════════════════════════════
  // sendMsg()
  // Main send function — reads the input, calls the API, shows the reply.
  // ══════════════════════════════════════
  async function sendMsg() {
    const input = document.getElementById('chatInput');
    const text  = input.value.trim();

    if (!text)    return;
    if (isBusy)   return;  // prevent double-sending


    // clear input and show user's message
    input.value = '';
    addMessage('user', text);
    history.push({ role: 'user', content: text });

    // show typing dots and disable send button
    const typingId = showTyping();
    isBusy = true;
    document.getElementById('sendBtn').disabled = true;

    try {
      const reply = await callClaude();
      removeTyping(typingId);
      addMessage('ai', reply);
      history.push({ role: 'assistant', content: reply });

    } catch (error) {
      removeTyping(typingId);

      // give a human-readable error message
      let msg = 'Something went wrong. Please try again.';
      if (error.message.includes('401')) msg = 'Invalid API key. Please check your key.';
      if (error.message.includes('fetch')) msg = 'Network error. Check your internet connection.';

      addMessage('ai', `⚠️ ${msg}`);
    }

    isBusy = false;
    document.getElementById('sendBtn').disabled = false;
  }


  // ══════════════════════════════════════
  // callClaude()
  // Sends the conversation to the Claude API and returns the reply text.
  // ══════════════════════════════════════
  async function callClaude() {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system:   buildSystemPrompt(),
        messages: history,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`API ${response.status}: ${err?.detail || 'unknown error'}`);
    }

    const data = await response.json();
    return data.reply;
  }


  // ══════════════════════════════════════
  // buildSystemPrompt()
  // Creates the instruction sent to Claude along with every message.
  // This is what makes the AI aware of the student's specific situation.
  // ══════════════════════════════════════
  function buildSystemPrompt() {
    // get current form values (if student already searched)
    const rank  = document.getElementById('rank')?.value  || 'not entered yet';
    const cat   = document.getElementById('cat')?.value   || 'not selected yet';
    const quota = document.getElementById('quota')?.value || 'General';

    // get top safe colleges from the last search
    const safeColleges = window.Predictor
      ? window.Predictor.getResults()
          .filter(r => r.chance === 'safe')
          .slice(0, 5)
          .map(r => `• ${r.cn} — ${r.course} (cutoff ${r.cutoff.toLocaleString()})`)
          .join('\n')
      : 'Student has not searched yet.';

    return `You are "Saathi", a friendly KCET Karnataka option entry counsellor.
You help students fill the KEA option entry portal correctly.

STUDENT DETAILS:
  Rank     : ${rank}
  Category : ${cat}
  Quota    : ${quota}

THEIR TOP SAFE COLLEGES:
${safeColleges || 'No search done yet.'}

YOUR RULES:
- Be friendly and specific. Use simple English.
- Keep every reply under 120 words.
- If comparing colleges, use the cutoff numbers above.
- Always remind students to fill at least 40 options when relevant.
- Do not make up cutoff numbers you don't have.`;
  }


  // ══════════════════════════════════════
  // Chat UI helpers
  // ══════════════════════════════════════

  /*
    addMessage(role, text)
    Creates a chat bubble and appends it to #chatMessages.
    role = 'ai' or 'user'
  */
  function addMessage(role, text) {
    const msgs = document.getElementById('chatMessages');
    const div  = document.createElement('div');
    div.className = `message ${role}`;

    // escape HTML to prevent XSS (user input could contain <script> tags)
    const safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    div.innerHTML = `
      <div class="msg-avatar">${role === 'ai' ? '🎓' : '👤'}</div>
      <div class="msg-bubble">${safe}</div>`;

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;  // auto-scroll to bottom
  }

  /*
    showTyping()
    Shows three animated dots while waiting for the AI.
    Returns a unique id so we can remove it later.
  */
  function showTyping() {
    const msgs = document.getElementById('chatMessages');
    const id   = `typing_${Date.now()}`;
    const div  = document.createElement('div');
    div.className = 'message ai';
    div.id        = id;
    div.innerHTML = `
      <div class="msg-avatar">🎓</div>
      <div class="msg-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }


  // ── keyboard shortcut: Enter to send ──
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('chatInput');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMsg();
        }
      });
    }


  });


  // ── public functions ──
  return { sendQ, sendMsg };

})();
