// XActions Extension — AI Agent UI
// Primary auth: xAI OAuth (device code) — not API key
// by nichxbt

(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  let busy = false;
  let oauthPollTimer = null;

  const PROVIDER_DEFAULT_MODELS = {
    'xai-oauth': 'grok-4.5',
    xai: 'grok-4.5',
    openrouter: 'x-ai/grok-4.5',
    openai: 'gpt-4o-mini',
    ollama: 'llama3.2',
  };

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  function showToast(message, type = 'info') {
    if (typeof window.XActionsPopupToast === 'function') {
      window.XActionsPopupToast(message, type);
      return;
    }
    console.log(`[agent ${type}]`, message);
  }

  function splitList(str) {
    return String(str || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function updateStatusLine(llm, oauth, toolCount) {
    const el = $('#agentStatusLine');
    if (!el) return;
    const model = llm?.model || 'grok-4.5';
    if (oauth?.signedIn) {
      el.textContent = `${model} · sẵn sàng phân tích`;
      setPipelineStage(oauth.signedIn ? 'analyze' : 'setup', false);
      return;
    }
    if (llm?.provider === 'xai-oauth' || !llm?.provider) {
      el.textContent = 'Cần đăng nhập xAI (Grok)';
      setPipelineStage('setup', false);
      return;
    }
    if (llm?.apiKey) {
      el.textContent = `${llm.provider} · ${model} · key OK`;
      setPipelineStage('analyze', false);
      return;
    }
    el.textContent = 'Cần đăng nhập Grok';
    setPipelineStage('setup', false);
  }

  /** Visual pipeline: setup | analyze | playbook | run */
  function setPipelineStage(stage, running) {
    const order = ['setup', 'analyze', 'playbook', 'run'];
    const idx = order.indexOf(stage);
    order.forEach((s, i) => {
      const el = document.getElementById(
        s === 'setup'
          ? 'pipeSetup'
          : s === 'analyze'
            ? 'pipeAnalyze'
            : s === 'playbook'
              ? 'pipePlaybook'
              : 'pipeRun',
      );
      if (!el) return;
      el.classList.remove('is-active', 'is-done');
      if (running && i === idx) el.classList.add('is-active');
      else if (i < idx) el.classList.add('is-done');
      else if (i === idx) el.classList.add('is-active');
    });
  }

  function renderOauthStatus(oauth) {
    const el = $('#agentOauthStatus');
    const btnLogin = $('#btnXaiLogin');
    const btnLogout = $('#btnXaiLogout');
    if (!el) return;

    if (oauth?.signedIn) {
      const exp = oauth.expires_at
        ? new Date(oauth.expires_at).toLocaleTimeString()
        : '—';
      el.textContent = `✅ Signed in with xAI OAuth · token ~until ${exp}`;
      el.className = 'agent-oauth-status ok';
      btnLogin?.classList.add('hidden');
      btnLogout?.classList.remove('hidden');
    } else if (oauth?.expired) {
      el.textContent = '⚠️ Session expired — Login with xAI again';
      el.className = 'agent-oauth-status warn';
      btnLogin?.classList.remove('hidden');
      btnLogout?.classList.add('hidden');
    } else {
      el.textContent = 'Not signed in — use Login with xAI (OAuth device flow)';
      el.className = 'agent-oauth-status';
      btnLogin?.classList.remove('hidden');
      btnLogout?.classList.add('hidden');
    }
  }

  function syncProviderUi(provider) {
    const keyWrap = $('#agentApiKeyWrap');
    if (provider === 'xai-oauth' || provider === 'ollama') {
      keyWrap?.classList.add('hidden');
    } else {
      keyWrap?.classList.remove('hidden');
    }
  }

  function getSelectedModel() {
    const sel = $('#agentModelSelect');
    if (!sel || sel.value === 'custom') {
      return ($('#agentModel')?.value || 'grok-4.5').trim();
    }
    return sel.value;
  }

  function setModelControls(model) {
    const sel = $('#agentModelSelect');
    const wrap = $('#agentModelCustomWrap');
    const custom = $('#agentModel');
    if (!sel) {
      if (custom) custom.value = model || 'grok-4.5';
      return;
    }
    const known = Array.from(sel.options).some(
      (o) => o.value === model && o.value !== 'custom',
    );
    if (known) {
      sel.value = model;
      wrap?.classList.add('hidden');
      if (custom) custom.value = model;
    } else {
      sel.value = 'custom';
      wrap?.classList.remove('hidden');
      if (custom) custom.value = model || 'grok-4.5';
    }
  }

  async function loadConfigIntoForm() {
    const res = await chrome.runtime.sendMessage({ type: 'AGENT_GET_CONFIG' });
    if (!res?.success) return;

    let llm = res.llm || {};
    const persona = res.persona || {};
    const safety = res.safety || {};
    const oauth = res.oauth || { signedIn: false };

    // Force OAuth path as default
    if (!llm.provider || llm.provider === 'xai') {
      if (!llm.apiKey) {
        llm = { ...llm, provider: 'xai-oauth', authMode: 'oauth', model: llm.model || 'grok-4.5' };
      }
    }

    if ($('#agentProvider')) $('#agentProvider').value = llm.provider || 'xai-oauth';
    if ($('#agentApiKey')) $('#agentApiKey').value = llm.apiKey || '';
    if ($('#agentBaseUrl')) $('#agentBaseUrl').value = llm.baseUrl || '';
    setModelControls(llm.model || 'grok-4.5');
    syncProviderUi(llm.provider || 'xai-oauth');

    if ($('#agentPersonaName')) $('#agentPersonaName').value = persona.name || '';
    if ($('#agentPersonaNiche')) $('#agentPersonaNiche').value = persona.niche || '';
    if ($('#agentPersonaTone')) $('#agentPersonaTone').value = persona.tone || '';
    if ($('#agentPersonaExpertise')) {
      $('#agentPersonaExpertise').value = Array.isArray(persona.expertise)
        ? persona.expertise.join(', ')
        : persona.expertise || '';
    }
    if ($('#agentPersonaAvoid')) {
      $('#agentPersonaAvoid').value = Array.isArray(persona.avoid)
        ? persona.avoid.join(', ')
        : persona.avoid || '';
    }
    if ($('#agentMaxActions')) {
      $('#agentMaxActions').value = safety.maxActionsPerTurn || 20;
    }

    renderOauthStatus(oauth);
    updateStatusLine(llm, oauth, res.toolCount || 0);
    renderHistory(res.history || []);
  }

  function readLlmForm() {
    const provider = $('#agentProvider')?.value || 'xai-oauth';
    return {
      provider,
      authMode: provider === 'xai-oauth' ? 'oauth' : 'api_key',
      apiKey: $('#agentApiKey')?.value.trim() || '',
      model: getSelectedModel(),
      baseUrl: $('#agentBaseUrl')?.value.trim() || '',
    };
  }

  async function saveConfig() {
    const llm = readLlmForm();
    const persona = {
      name: $('#agentPersonaName').value.trim() || 'XActions Agent',
      niche: $('#agentPersonaNiche').value.trim(),
      tone: $('#agentPersonaTone').value.trim() || 'concise, helpful',
      expertise: splitList($('#agentPersonaExpertise').value),
      avoid: splitList($('#agentPersonaAvoid').value),
      opinions: ['Prefer safe automation limits'],
    };
    const safety = {
      maxActionsPerTurn: Math.min(
        Math.max(parseInt($('#agentMaxActions').value, 10) || 20, 1),
        50,
      ),
      requireConfirmHighRisk: true,
    };

    await chrome.runtime.sendMessage({
      type: 'AGENT_SAVE_CONFIG',
      config: { llm, persona, safety },
    });

    const st = await chrome.runtime.sendMessage({ type: 'XAI_OAUTH_STATUS' });
    updateStatusLine(llm, st);
    showToast(
      llm.provider === 'xai-oauth'
        ? `Saved · Grok OAuth · ${llm.model}`
        : 'Agent config saved',
      'success',
    );
    $('#agentConfigPanel')?.classList.add('hidden');
  }

  function stopOauthPoll() {
    if (oauthPollTimer) {
      clearInterval(oauthPollTimer);
      oauthPollTimer = null;
    }
  }

  async function startXaiLogin() {
    stopOauthPoll();
    const deviceBox = $('#agentOauthDevice');
    const resultEl = $('#agentTestResult');
    if (resultEl) {
      resultEl.textContent = 'Starting xAI login…';
      resultEl.className = 'agent-test-result pending';
    }

    // Ensure provider is oauth
    if ($('#agentProvider')) $('#agentProvider').value = 'xai-oauth';
    syncProviderUi('xai-oauth');

    const res = await chrome.runtime.sendMessage({ type: 'XAI_OAUTH_START' });
    if (!res?.success) {
      showToast(res?.error || 'Login start failed', 'error');
      if (resultEl) {
        resultEl.textContent = `❌ ${res?.error || 'failed'}`;
        resultEl.className = 'agent-test-result err';
      }
      return;
    }

    deviceBox?.classList.remove('hidden');
    if ($('#agentUserCode')) $('#agentUserCode').textContent = res.user_code || '————';
    const link = $('#agentVerifyLink');
    if (link) {
      const url = res.verification_uri_complete || res.verification_uri;
      link.href = url || 'https://accounts.x.ai';
      link.textContent = url || 'Open accounts.x.ai';
    }

    if (resultEl) {
      resultEl.textContent = `Enter code ${res.user_code} if asked — waiting for approval…`;
      resultEl.className = 'agent-test-result pending';
    }
    showToast('Approve login in the browser tab', 'info');

    const intervalMs = Math.max((res.interval || 5) * 1000, 3000);
    oauthPollTimer = setInterval(() => void pollOauthOnce(resultEl), intervalMs);
  }

  async function pollOauthOnce(resultEl) {
    const poll = await chrome.runtime.sendMessage({ type: 'XAI_OAUTH_POLL' });
    if (poll?.status === 'pending') return;

    stopOauthPoll();

    if (poll?.status === 'success') {
      $('#agentOauthDevice')?.classList.add('hidden');
      renderOauthStatus(poll.tokens || { signedIn: true });
      if (resultEl) {
        resultEl.textContent = '✅ xAI OAuth signed in';
        resultEl.className = 'agent-test-result ok';
      }
      // Persist provider preference
      await chrome.runtime.sendMessage({
        type: 'AGENT_SAVE_CONFIG',
        config: {
          llm: {
            ...readLlmForm(),
            provider: 'xai-oauth',
            authMode: 'oauth',
            model: getSelectedModel() || 'grok-4.5',
          },
        },
      });
      updateStatusLine(readLlmForm(), { signedIn: true });
      showToast('Signed in with xAI', 'success');
      return;
    }

    if (resultEl) {
      resultEl.textContent = `❌ ${poll?.error || poll?.status || 'login failed'}`;
      resultEl.className = 'agent-test-result err';
    }
    showToast(poll?.error || 'xAI login failed', 'error');
  }

  async function logoutXai() {
    stopOauthPoll();
    await chrome.runtime.sendMessage({ type: 'XAI_OAUTH_LOGOUT' });
    renderOauthStatus({ signedIn: false });
    updateStatusLine(readLlmForm(), { signedIn: false });
    showToast('Logged out of xAI', 'info');
  }

  async function testSession() {
    const resultEl = $('#agentTestResult');
    const btn = $('#btnAgentTest');
    const llm = readLlmForm();
    if (resultEl) {
      resultEl.textContent = 'Testing…';
      resultEl.className = 'agent-test-result pending';
    }
    if (btn) btn.disabled = true;

    try {
      await chrome.runtime.sendMessage({
        type: 'AGENT_SAVE_CONFIG',
        config: { llm },
      });
      const res = await chrome.runtime.sendMessage({
        type: 'AGENT_TEST_LLM',
        config: llm,
      });
      if (res?.ok) {
        if (resultEl) {
          resultEl.textContent = `✅ ${res.model || llm.model}`;
          resultEl.className = 'agent-test-result ok';
        }
        showToast(`Grok OK · ${res.model}`, 'success');
      } else {
        if (resultEl) {
          resultEl.textContent = `❌ ${res?.error || 'failed'}`;
          resultEl.className = 'agent-test-result err';
        }
        showToast(res?.error || 'Test failed', 'error');
      }
    } catch (err) {
      if (resultEl) {
        resultEl.textContent = `❌ ${err.message || err}`;
        resultEl.className = 'agent-test-result err';
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderHistory(history) {
    const chat = $('#agentChat');
    if (!chat) return;
    const empty = $('#agentEmpty');
    chat.querySelectorAll('.agent-msg').forEach((n) => n.remove());
    if (!history.length) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    for (const m of history) {
      if (m.role === 'user' || m.role === 'assistant') {
        appendMessage(m.role, m.content, m.toolTrace, false);
      }
    }
    chat.scrollTop = chat.scrollHeight;
  }

  function appendMessage(role, content, toolTrace, scroll = true) {
    const chat = $('#agentChat');
    const empty = $('#agentEmpty');
    if (empty) empty.style.display = 'none';
    const div = document.createElement('div');
    div.className = `agent-msg agent-msg-${role}`;
    const label = role === 'user' ? 'You' : 'Agent';
    let toolsHtml = '';
    if (toolTrace?.length) {
      toolsHtml = `<div class="agent-tools">${toolTrace
        .map(
          (t) =>
            `<div class="agent-tool"><span class="agent-tool-name">🔧 ${escapeHtml(t.name)}</span><pre>${escapeHtml(JSON.stringify(t.result).slice(0, 400))}</pre></div>`,
        )
        .join('')}</div>`;
    }
    div.innerHTML = `
      <div class="agent-msg-meta">${label}</div>
      <div class="agent-msg-body">${escapeHtml(content || '').replace(/\n/g, '<br>')}</div>
      ${toolsHtml}
    `;
    chat.appendChild(div);
    if (scroll) chat.scrollTop = chat.scrollHeight;
    return div;
  }

  function setBusy(v) {
    busy = v;
    const btn = $('#btnAgentSend');
    const input = $('#agentInput');
    const strat = $('#btnRunStrategy');
    const runPb = $('#btnRunPlaybook');
    const runForce = $('#btnRunPlaybookForce');
    if (btn) {
      btn.disabled = v;
      btn.textContent = v ? '…' : '↑';
    }
    if (input) input.disabled = v;
    if (strat) strat.disabled = v;
    if (runPb) runPb.disabled = v;
    if (runForce) runForce.disabled = v;
  }

  function setStrategyProgress(text, active = false) {
    const el = $('#agentStrategyProgress');
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('active', !!active && !!text);
  }

  function renderPlaybookCard(playbook) {
    const card = $('#agentPlaybookCard');
    const wrap = $('#agentPlaybookWrap');
    if (!card) return;

    if (!playbook?.playbook) {
      card.innerHTML = '';
      wrap?.classList.add('hidden');
      return;
    }

    const a = playbook.analysis || {};
    const pb = playbook.playbook || {};
    const steps = pb.steps || [];
    const aud = a.audience?.primary;

    wrap?.classList.remove('hidden');
    setPipelineStage('playbook', false);
    card.innerHTML = `
      <h4>📋 Kịch bản · @${escapeHtml(playbook.account?.handle || '—')}</h4>
      <div class="pb-meta">
        Niche: <strong>${escapeHtml(a.niche || '—')}</strong>
        · Goal: ${escapeHtml(pb.goal || '—')}
        · Risk: ${escapeHtml(pb.riskLevel || '—')}
        · ${steps.length} bước
      </div>
      <div class="pb-meta">${escapeHtml((playbook.executiveBrief || a.accountSummary || '').slice(0, 280))}</div>
      ${aud ? `<div class="pb-meta">Đối tượng: <strong>${escapeHtml(aud.label || '')}</strong> — ${escapeHtml((aud.who || '').slice(0, 120))}</div>` : ''}
      <ul class="agent-step-list">
        ${steps
          .map((s) => {
            const en = s.enabled !== false;
            const warn = s.requiresConfirm
              ? '<span class="step-warn"> ⚠️ confirm</span>'
              : '';
            const st =
              s.status && s.status !== 'pending'
                ? ` · ${escapeHtml(s.status)}`
                : '';
            return `<li class="${en ? '' : 'disabled'}" data-step-id="${escapeHtml(s.id)}">
              <input type="checkbox" class="step-enable" data-id="${escapeHtml(s.id)}" ${en ? 'checked' : ''} title="Bật bước này">
              <div class="step-body">
                <div class="step-title">${escapeHtml(s.title || s.tool)}${warn}${st}</div>
                <div class="step-meta"><code>${escapeHtml(s.tool)}</code> · ${escapeHtml((s.reason || '').slice(0, 100))}</div>
              </div>
            </li>`;
          })
          .join('')}
      </ul>
      <div class="pb-meta" style="margin-top:8px">Bỏ tick = không chạy. ⚠️ cần Force hoặc bỏ confirm.</div>
    `;

    card.querySelectorAll('.step-enable').forEach((cb) => {
      cb.addEventListener('change', () => {
        void persistStepEnabled(cb.dataset.id, cb.checked);
        const li = cb.closest('li');
        li?.classList.toggle('disabled', !cb.checked);
      });
    });
  }

  async function persistStepEnabled(id, enabled) {
    try {
      await chrome.runtime.sendMessage({
        type: 'AGENT_UPDATE_STEPS',
        updates: [{ id, enabled }],
      });
    } catch {
      /* ignore */
    }
  }

  function collectSelectedStepIds() {
    const card = $('#agentPlaybookCard');
    if (!card) return null;
    const ids = [];
    card.querySelectorAll('.step-enable:checked').forEach((cb) => {
      if (cb.dataset.id) ids.push(cb.dataset.id);
    });
    return ids;
  }

  async function loadPlaybookUi() {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'AGENT_GET_PLAYBOOK' });
      if (res?.ok && res.playbook) {
        renderPlaybookCard(res.playbook);
        setPipelineStage('playbook', false);
        if (res.lastResult?.ok && res.lastResult?.at) {
          const age = Date.now() - res.lastResult.at;
          if (age < 10 * 60 * 1000) {
            setStrategyProgress(
              `Kịch bản @${res.playbook.account?.handle || '?'} · ${res.playbook.playbook?.steps?.length || 0} bước`,
              false,
            );
          }
        }
      } else {
        renderPlaybookCard(null);
        // Strategy may have finished while popup was closed
        if (res?.lastResult?.ok && !res.playbook) {
          /* playbook cleared */
        } else if (res?.lastResult && !res.lastResult.ok) {
          setStrategyProgress(`⚠️ Lần phân tích trước: ${res.lastResult.error || 'lỗi'}`, false);
        }
      }

      // If strategy still running (popup reopened)
      const st = await chrome.storage.local.get(['agentStrategyProgress']);
      const p = st.agentStrategyProgress;
      if (p?.phase && p.phase !== 'idle' && p.phase !== 'done') {
        setStrategyProgress(p.label || 'Đang phân tích…', true);
      }
    } catch {
      /* ignore */
    }
  }

  async function runStrategy() {
    if (busy) return;
    setBusy(true);
    setPipelineStage('analyze', true);
    setStrategyProgress('Đang thu thập dữ liệu tab x.com…', true);
    // Expand chat drawer so progress messages are visible
    const drawer = $('#planChatDrawer');
    if (drawer) drawer.open = true;
    const thinking = appendMessage('assistant', 'Đang phân tích tài khoản (profile, feed, style)…');
    thinking.classList.add('agent-msg-thinking');

    // poll progress lightly
    const poll = setInterval(async () => {
      try {
        const st = await chrome.storage.local.get(['agentStrategyProgress']);
        const p = st.agentStrategyProgress;
        if (p?.label) setStrategyProgress(p.label, true);
      } catch {
        /* ignore */
      }
    }, 800);

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'AGENT_RUN_STRATEGY',
        languageHint:
          'executiveBrief và text người dùng bằng tiếng Việt. JSON keys English.',
      });
      thinking.remove();
      if (!res?.ok) {
        appendMessage('assistant', res?.error || 'Phân tích thất bại');
        showToast(res?.error || 'Strategy failed', 'error');
        setStrategyProgress('');
        return;
      }
      const brief = res.brief || res.executiveBrief || 'Đã tạo kịch bản.';
      appendMessage('assistant', brief);
      if (res.playbook) renderPlaybookCard(res.playbook);
      setPipelineStage('playbook', false);
      setStrategyProgress('Kịch bản sẵn sàng — tick bước rồi Chạy đã chọn', false);
      showToast('Kịch bản đã tạo', 'success');
    } catch (err) {
      thinking.remove();
      appendMessage('assistant', err.message || String(err));
      showToast(err.message || 'Strategy error', 'error');
      setStrategyProgress('');
      setPipelineStage('analyze', false);
    } finally {
      clearInterval(poll);
      setBusy(false);
    }
  }

  async function executePlaybook(force = false) {
    if (busy) return;
    const selectedStepIds = collectSelectedStepIds();
    if (selectedStepIds && selectedStepIds.length === 0) {
      showToast('Chọn ít nhất 1 bước', 'error');
      return;
    }
    setBusy(true);
    setPipelineStage('run', true);
    setStrategyProgress(
      force ? 'Force: chạy cả bước cần xác nhận…' : 'Đang chạy các bước đã chọn…',
      true,
    );
    const thinking = appendMessage(
      'assistant',
      force ? '▶ Force execute (gồm bước confirm)…' : '▶ Đang thực thi kịch bản…',
    );
    thinking.classList.add('agent-msg-thinking');
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'AGENT_EXECUTE_PLAYBOOK',
        force,
        selectedStepIds,
      });
      thinking.remove();
      if (!res?.ok) {
        appendMessage('assistant', res?.error || 'Chạy kịch bản thất bại');
        showToast(res?.error || 'Execute failed', 'error');
        return;
      }
      appendMessage(
        'assistant',
        `${res.summary || 'Done'}\n\n${(res.results || [])
          .map(
            (r) =>
              `• ${r.tool}: ${r.status || (r.skipped ? 'skipped' : 'ok')}${r.reason ? ` (${r.reason})` : ''}`,
          )
          .join('\n')}`,
      );
      if (res.playbook) renderPlaybookCard(res.playbook);
      setPipelineStage('run', false);
      document.getElementById('pipeRun')?.classList.add('is-done');
      setStrategyProgress('Đã chạy kịch bản', false);
      showToast(res.summary || 'Playbook done', 'success');
    } catch (err) {
      thinking.remove();
      appendMessage('assistant', err.message || String(err));
      showToast(err.message || 'Execute error', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(text) {
    const content = (text || $('#agentInput')?.value || '').trim();
    if (!content || busy) return;
    if ($('#agentInput')) $('#agentInput').value = '';
    appendMessage('user', content);
    setBusy(true);
    const thinking = appendMessage('assistant', 'Thinking…');
    thinking.classList.add('agent-msg-thinking');
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'AGENT_CHAT',
        userMessage: content,
      });
      thinking.remove();
      if (!res?.ok) {
        appendMessage('assistant', res?.error || 'Agent failed');
        showToast(res?.error || 'Agent failed', 'error');
      } else {
        appendMessage('assistant', res.content || '(no reply)', res.toolTrace);
      }
    } catch (err) {
      thinking.remove();
      appendMessage('assistant', err.message || String(err));
      showToast(err.message || 'Agent error', 'error');
    } finally {
      setBusy(false);
    }
  }

  function setupAgentUi() {
    if (!$('#tab-agent')) return;

    const panel = $('#agentConfigPanel');
    $('#btnAgentConfig')?.addEventListener('click', () => {
      panel?.classList.toggle('hidden');
    });
    $('#btnAgentSaveConfig')?.addEventListener('click', () => void saveConfig());
    $('#btnAgentTest')?.addEventListener('click', () => void testSession());
    $('#btnXaiLogin')?.addEventListener('click', () => void startXaiLogin());
    $('#btnXaiLogout')?.addEventListener('click', () => void logoutXai());
    $('#btnAgentClear')?.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'AGENT_CLEAR_HISTORY' });
      renderHistory([]);
      showToast('Agent chat cleared', 'info');
    });
    $('#btnAgentSend')?.addEventListener('click', () => void sendMessage());
    $('#agentInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    });
    document.querySelectorAll('.agent-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.action === 'strategy') {
          void runStrategy();
          return;
        }
        void sendMessage(btn.dataset.prompt || btn.textContent);
      });
    });
    $('#btnRunStrategy')?.addEventListener('click', () => void runStrategy());
    $('#btnRefreshStrategy')?.addEventListener('click', () => void runStrategy());
    $('#btnRunPlaybook')?.addEventListener('click', () => void executePlaybook(false));
    $('#btnRunPlaybookForce')?.addEventListener('click', () => {
      if (
        !confirm(
          'Force sẽ chạy cả bước ⚠️ (unfollow dryRun, growth suite…). Tiếp tục?',
        )
      ) {
        return;
      }
      void executePlaybook(true);
    });
    $('#btnClearPlaybook')?.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'AGENT_CLEAR_PLAYBOOK' });
      renderPlaybookCard(null);
      setStrategyProgress('');
      setPipelineStage('analyze', false);
      showToast('Đã xóa kịch bản', 'info');
    });
    $('#btnOpenAgentTab')?.addEventListener('click', () => {
      document.querySelector('.tab[data-tab="agent"]')?.click();
    });

    $('#agentProvider')?.addEventListener('change', () => {
      const p = $('#agentProvider').value;
      syncProviderUi(p);
      setModelControls(PROVIDER_DEFAULT_MODELS[p] || 'grok-4.5');
    });

    $('#agentModelSelect')?.addEventListener('change', () => {
      const sel = $('#agentModelSelect');
      const wrap = $('#agentModelCustomWrap');
      if (sel.value === 'custom') {
        wrap?.classList.remove('hidden');
      } else {
        wrap?.classList.add('hidden');
        if ($('#agentModel')) $('#agentModel').value = sel.value;
      }
    });

    void loadConfigIntoForm();
    void loadPlaybookUi();
  }

  window.XActionsAgentUI = {
    setupAgentUi,
    loadConfigIntoForm,
    sendMessage,
    runStrategy,
    executePlaybook,
  };
})();
