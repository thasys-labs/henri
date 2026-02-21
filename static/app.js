// ── Theme handling ─────────────────────────────────────────────
const themeButtons = document.querySelectorAll('.theme-btn');
const root = document.documentElement;

function setTheme(theme) {
  if (theme === 'dark') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  localStorage.setItem('henri-theme', theme);
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  // Update Henri portrait
  const portrait = document.getElementById('henri-portrait');
  if (portrait) portrait.src = `/assets/henri-${theme}.svg`;
}

// Initialize theme from localStorage or default to dark
const savedTheme = localStorage.getItem('henri-theme') || 'dark';
setTheme(savedTheme);

themeButtons.forEach(btn => {
  btn.addEventListener('click', () => setTheme(btn.dataset.theme));
});

// ── Beer panel close ───────────────────────────────────────────
const beerPanel = document.getElementById('beer-panel');
const beerOverlay = document.getElementById('beer-overlay');

function closeBeerPanel() {
  beerPanel.classList.remove('visible');
  beerOverlay.classList.remove('visible');
}

function openBeerPanel() {
  beerPanel.classList.add('visible');
  beerOverlay.classList.add('visible');
}

document.getElementById('beer-close').addEventListener('click', closeBeerPanel);
beerOverlay.addEventListener('click', closeBeerPanel);

const messagesEl = document.getElementById('messages');
const inputEl    = document.getElementById('user-input');
const sendBtn    = document.getElementById('send-btn');

// ── Beer data (loaded from local JSON) ──────────────────────────
let BEER_DATA = {};

// Load beer data on startup
fetch('/assets/beers.json')
  .then(res => res.json())
  .then(data => { BEER_DATA = data; })
  .catch(err => console.error('Failed to load beer data:', err));

function findBeer(name) {
  if (BEER_DATA[name]) return { name, ...BEER_DATA[name] };
  const lower = name.toLowerCase();
  for (const [key, data] of Object.entries(BEER_DATA)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return { name: key, ...data };
    }
  }
  return null;
}

const conversationHistory = [];
const displayMessages = [];
let isLoading = false;

// ── Session persistence (sessionStorage – cleared when tab closes) ──
const SESSION_KEY = 'henri-session';

function saveSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      history: conversationHistory,
      messages: displayMessages,
    }));
  } catch(e) {}
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function restoreSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (saved && saved.messages && saved.messages.length > 0) {
      conversationHistory.push(...saved.history);
      for (const msg of saved.messages) {
        addMessage(msg.role, msg.text);
      }
      return true;
    }
  } catch(e) {}
  return false;
}

function startOver() {
  if (isLoading) return;
  conversationHistory.length = 0;
  displayMessages.length = 0;
  clearSession();
  messagesEl.innerHTML = '<div class="day-label">Einbecker Brauhaus</div>';
  closeBeerPanel();
  greet();
}

// ── DOM helpers ────────────────────────────────────────────────
function createBubble(role) {
  const isHenri = role === 'assistant';
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${isHenri ? 'henri' : 'user'}`;
  if (isHenri) {
    const av = document.createElement('div');
    av.className = 'msg-avatar';
    av.textContent = 'H';
    wrapper.appendChild(av);
  }
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return bubble;
}

function addMessage(role, text) {
  const bubble = createBubble(role);
  if (role === 'assistant') {
    bubble.innerHTML = marked.parse(text);
  } else {
    bubble.textContent = text;
  }
}

function addTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.className = 'msg henri typing';
  wrapper.id = 'typing';
  const av = document.createElement('div');
  av.className = 'msg-avatar';
  av.textContent = 'H';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  wrapper.appendChild(av);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
}

function removeTypingIndicator() { document.getElementById('typing')?.remove(); }

function showError(msg) {
  const el = document.createElement('div');
  el.className = 'error-msg';
  el.textContent = msg;
  messagesEl.appendChild(el);
  scrollToBottom();
  setTimeout(() => el.remove(), 6000);
}

function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

// ── SSE stream ─────────────────────────────────────────────────
// Returns { text: string, toolUse: {id, name, input} | null }
async function streamChat(messages) {
  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Fehler ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textBubble = null;
  let fullText = '';
  let toolUse = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.error) throw new Error(parsed.error);

        if (parsed.text !== undefined) {
          if (!textBubble) {
            removeTypingIndicator();
            textBubble = createBubble('assistant');
          }
          fullText += parsed.text;
          textBubble.innerHTML = marked.parse(fullText);
          scrollToBottom();
        } else if (parsed.tool_use) {
          toolUse = parsed.tool_use;
          // Render show_beer immediately so panel opens while text streams
          if (toolUse.name === 'show_beer') {
            renderBeerPanel(toolUse.input);
          }
        }
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
    }
  }
  return { text: fullText, toolUse };
}

// ── Beer panel ─────────────────────────────────────────────────
function renderBeerPanel(input) {
  // Get beer data from local storage, fallback to tool input
  const beer = findBeer(input.name) || input;

  const imgEl = document.getElementById('beer-img');
  imgEl.src = beer.image || '';
  // Re-trigger animation by cloning the img
  const fresh = imgEl.cloneNode();
  imgEl.replaceWith(fresh);

  document.getElementById('beer-style').textContent = beer.style || '';
  document.getElementById('beer-name').textContent  = beer.name  || input.name || '';
  document.getElementById('beer-note').textContent  = beer.note  || '';
  const pairingRow = document.getElementById('beer-pairing-row');
  if (beer.pairing) {
    document.getElementById('beer-pairing').textContent = beer.pairing;
    pairingRow.style.display = 'flex';
  } else {
    pairingRow.style.display = 'none';
  }
  openBeerPanel();
}

// ── Multiple choice widget ─────────────────────────────────────
function renderMultipleChoice(question, options, toolId) {
  removeTypingIndicator();
  const wrapper = document.createElement('div');
  wrapper.className = 'msg henri';
  const av = document.createElement('div');
  av.className = 'msg-avatar';
  av.textContent = 'H';
  const card = document.createElement('div');
  card.className = 'mc-card';
  const q = document.createElement('div');
  q.className = 'mc-question';
  q.textContent = question;
  card.appendChild(q);
  const opts = document.createElement('div');
  opts.className = 'mc-options';

  for (const option of options) {
    const btn = document.createElement('button');
    btn.className = 'mc-btn';
    btn.textContent = option;
    btn.addEventListener('click', () => {
      card.querySelectorAll('.mc-btn').forEach(b => { b.disabled = true; });
      btn.classList.add('selected');

      // Show selection as user bubble
      addMessage('user', option);
      displayMessages.push({ role: 'user', text: option });

      // Add tool_result to history
      conversationHistory.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolId, content: option }],
      });

      // Continue conversation
      isLoading = true;
      sendBtn.disabled = true;
      addTypingIndicator();
      handleResponse();
    });
    opts.appendChild(btn);
  }

  card.appendChild(opts);

  // ── "oder" + free-text input ──
  const divider = document.createElement('div');
  divider.className = 'mc-divider';
  divider.textContent = 'oder';
  card.appendChild(divider);

  const textRow = document.createElement('div');
  textRow.className = 'mc-text-row';

  const textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'mc-text-input';
  textInput.placeholder = 'Eigene Antwort...';

  const textBtn = document.createElement('button');
  textBtn.className = 'mc-text-btn';
  textBtn.title = 'Absenden';
  textBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';

  function submitCustom() {
    const val = textInput.value.trim();
    if (!val || isLoading) return;
    card.querySelectorAll('.mc-btn').forEach(b => { b.disabled = true; });
    textInput.disabled = true;
    textBtn.disabled = true;
    addMessage('user', val);
    displayMessages.push({ role: 'user', text: val });
    conversationHistory.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolId, content: val }],
    });
    isLoading = true;
    sendBtn.disabled = true;
    addTypingIndicator();
    handleResponse();
  }

  textBtn.addEventListener('click', submitCustom);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitCustom(); }
  });

  textRow.appendChild(textInput);
  textRow.appendChild(textBtn);
  card.appendChild(textRow);

  wrapper.appendChild(av);
  wrapper.appendChild(card);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  // Only auto-focus on desktop to avoid opening keyboard on mobile
  if (window.innerWidth > 620) textInput.focus();
}

// ── Handle response (shared by send, greet, tool click) ────────
async function handleResponse() {
  try {
    const { text, toolUse } = await streamChat(conversationHistory);

    // Build assistant message content
    const content = [];
    if (text) content.push({ type: 'text', text });
    if (toolUse) content.push({ type: 'tool_use', id: toolUse.id, name: toolUse.name, input: toolUse.input });
    if (content.length) conversationHistory.push({ role: 'assistant', content });

    // Track streamed text for session persistence
    if (text) displayMessages.push({ role: 'assistant', text });

    if (toolUse?.name === 'show_beer') {
      // Show beer panel, then continue conversation to get Claude's follow-up text
      renderBeerPanel(toolUse.input);
      conversationHistory.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: 'Panel angezeigt' }],
      });
      addTypingIndicator();
      await handleResponse(); // Recurse to get follow-up
    } else if (toolUse?.name === 'multiple_choice') {
      // If no streamed text preceded the widget, store the question so it's readable on restore
      if (!text) displayMessages.push({ role: 'assistant', text: toolUse.input.question });
      renderMultipleChoice(toolUse.input.question, toolUse.input.options, toolUse.id);
      saveSession();
    } else {
      saveSession();
    }
  } catch (e) {
    removeTypingIndicator();
    showError(e.message || 'Verbindungsfehler. Bitte versuchen Sie es erneut.');
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    // Only auto-focus on desktop to avoid opening keyboard on mobile
    if (window.innerWidth > 620) inputEl.focus();
  }
}

// ── Input resize ───────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 130) + 'px';
});

// ── Send ───────────────────────────────────────────────────────
async function send() {
  const text = inputEl.value.trim();
  if (!text || isLoading) return;
  isLoading = true;
  sendBtn.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';
  addMessage('user', text);
  displayMessages.push({ role: 'user', text });
  conversationHistory.push({ role: 'user', content: text });
  addTypingIndicator();
  await handleResponse();
}

sendBtn.addEventListener('click', send);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

// ── Greeting ───────────────────────────────────────────────────
async function greet() {
  isLoading = true;
  sendBtn.disabled = true;
  addTypingIndicator();

  // Trigger message – not added to real history
  const trigger = [{ role: 'user', content: 'Begrüße mich kurz und stelle dich vor. Dann frage, womit du mir heute behilflich sein kannst.' }];

  try {
    const { text, toolUse } = await streamChat(trigger);

    // Build assistant message content
    const content = [];
    if (text) content.push({ type: 'text', text });
    if (toolUse) content.push({ type: 'tool_use', id: toolUse.id, name: toolUse.name, input: toolUse.input });
    if (content.length) conversationHistory.push({ role: 'assistant', content });

    // Track greeting text for session persistence
    if (text) displayMessages.push({ role: 'assistant', text });

    if (toolUse?.name === 'show_beer') {
      renderBeerPanel(toolUse.input);
      conversationHistory.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: 'Panel angezeigt' }],
      });
      addTypingIndicator();
      await handleResponse(); // Continue to get follow-up
    } else if (toolUse?.name === 'multiple_choice') {
      if (!text) displayMessages.push({ role: 'assistant', text: toolUse.input.question });
      renderMultipleChoice(toolUse.input.question, toolUse.input.options, toolUse.id);
      saveSession();
    } else {
      saveSession();
    }
  } catch {
    removeTypingIndicator();
    const fallback = 'Ah... willkommen. Ich bin Henri von Einbeck, Bier-Sommelier seit Anno Domini 1378. Womit darf ich Ihnen heute zu Diensten sein?';
    conversationHistory.push({ role: 'assistant', content: [{ type: 'text', text: fallback }] });
    addMessage('assistant', fallback);
    displayMessages.push({ role: 'assistant', text: fallback });
    saveSession();
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    // Only auto-focus on desktop to avoid opening keyboard on mobile
    if (window.innerWidth > 620) inputEl.focus();
  }
}

// ── Restart button ─────────────────────────────────────────────
document.getElementById('restart-btn').addEventListener('click', startOver);

// ── Init: restore session or greet ─────────────────────────────
if (!restoreSession()) {
  greet();
}
