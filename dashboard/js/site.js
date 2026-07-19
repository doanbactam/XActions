/* XActions shared UI runtime: command palette (Cmd/Ctrl-K), mobile nav,
 * scroll-reveal, and copy buttons. Depends on navdata.js (optional).
 * by nichxbt */
(function () {
  'use strict';

  /* ---- Scroll reveal ---- */
  const reveal = document.querySelectorAll('.reveal');
  if (reveal.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveal.forEach((el) => io.observe(el));
  } else {
    reveal.forEach((el) => el.classList.add('in'));
  }

  /* ---- Copy buttons: any [data-copy] copies the referenced element's text ---- */
  document.addEventListener('click', function (ev) {
    const btn = ev.target.closest('[data-copy]');
    if (!btn) return;
    const sel = btn.getAttribute('data-copy');
    const src = sel ? document.querySelector(sel) : btn.closest('.code')?.querySelector('pre');
    if (!src) return;
    const text = src.innerText;
    const done = () => { const o = btn.textContent; btn.textContent = 'Copied'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = o; btn.classList.remove('copied'); }, 1400); };
    navigator.clipboard.writeText(text).then(done).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {} ta.remove();
    });
  });

  /* ---- Mobile nav drawer ---- */
  const mnav = document.getElementById('mnav');
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-mnav-open]')) { mnav && mnav.classList.add('open'); document.body.style.overflow = 'hidden'; }
    if (ev.target.closest('[data-mnav-close]') || ev.target.classList.contains('mnav-scrim')) { mnav && mnav.classList.remove('open'); document.body.style.overflow = ''; }
  });

  /* ---- Command palette ---- */
  const nav = window.XA_NAV || { primary: [], secondary: [] };
  const all = [...nav.primary, ...nav.secondary];
  let box, input, list, sel = 0, filtered = [];

  function build() {
    box = document.createElement('div');
    box.className = 'cmdk';
    box.innerHTML =
      '<div class="cmdk-scrim" data-cmdk-close></div>' +
      '<div class="cmdk-box" role="dialog" aria-label="Search pages">' +
      '<input class="cmdk-input" placeholder="Search pages, docs, scripts..." aria-label="Search" autocomplete="off" spellcheck="false">' +
      '<div class="cmdk-list" role="listbox"></div>' +
      '<div class="cmdk-foot"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span></div>' +
      '</div>';
    document.body.appendChild(box);
    input = box.querySelector('.cmdk-input');
    list = box.querySelector('.cmdk-list');
    input.addEventListener('input', () => render(input.value));
    box.addEventListener('click', (e) => { if (e.target.closest('[data-cmdk-close]')) close(); const it = e.target.closest('.cmdk-item'); if (it) go(it.dataset.url); });
    input.addEventListener('keydown', onKey);
  }
  function score(q, item) {
    const t = (item.t + ' ' + item.u + ' ' + (item.s || '')).toLowerCase();
    q = q.toLowerCase().trim(); if (!q) return 1;
    if (t.includes(q)) return 100 - t.indexOf(q);
    let qi = 0; for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) qi++;
    return qi === q.length ? 20 : -1;
  }
  function render(q) {
    filtered = all.map((it) => ({ it, sc: score(q, it) })).filter((x) => x.sc >= 0)
      .sort((a, b) => b.sc - a.sc).slice(0, 40).map((x) => x.it);
    sel = 0;
    if (!filtered.length) { list.innerHTML = '<div class="cmdk-empty">No pages match “' + (q || '') + '”</div>'; return; }
    list.innerHTML = filtered.map((it, i) =>
      '<div class="cmdk-item' + (i === 0 ? ' sel' : '') + '" role="option" data-url="' + it.u + '">' +
      '<span class="ic">' + (it.i || iconFor(it.s)) + '</span><span>' + esc(it.t) + '</span>' +
      '<span class="sub">' + esc(it.s || '') + '</span></div>').join('');
  }
  function iconFor(s) { return ({ Docs: '\u{1F4C4}', Script: '\u{1F4DC}', Tutorial: '\u{1F393}', Blog: '✍️' }[s] || '→'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[sel]) go(filtered[sel].u); }
    else if (e.key === 'Escape') { close(); }
  }
  function move(d) {
    const items = list.querySelectorAll('.cmdk-item'); if (!items.length) return;
    items[sel] && items[sel].classList.remove('sel');
    sel = (sel + d + items.length) % items.length;
    items[sel].classList.add('sel'); items[sel].scrollIntoView({ block: 'nearest' });
  }
  function go(url) { if (url) window.location.href = url; }
  function open() { if (!box) build(); box.classList.add('open'); document.body.style.overflow = 'hidden'; input.value = ''; render(''); setTimeout(() => input.focus(), 20); }
  function close() { if (box) box.classList.remove('open'); document.body.style.overflow = ''; }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); box && box.classList.contains('open') ? close() : open(); }
    else if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-cmdk-open]')) { e.preventDefault(); open(); } });

  window.XActionsPalette = { open, close };
})();
