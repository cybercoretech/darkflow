// Darkflow site runtime: universal Cybercore theme chooser, shared footer, project
// signal cards, and the mdBook integration. Shared by the landing page and
// every Field Manual page (loaded there through book.toml additional-js).
//
// Privacy: no analytics. The theme choice is kept in this browser only
// (localStorage "cybercore-theme", the same key the other Cybercore sites use
// on this origin). Repository and CI numbers are read from GitHub's public
// API by the visitor's browser.
(() => {
  'use strict';

  const REPO = 'cybercoretech/darkflow';
  const STORE = 'cybercore-theme';
  const root = document.documentElement;

  // Themes: the universal Cybercore chooser (600 registry themes + 12 shared
  // signature mashups), loaded here so mdBook pages get it too. Palette slots
  // map onto Darkflow's --theme-* variables only.
  window.SITE = Object.assign(window.SITE || {}, { defaultTheme: 'cyberdyne-hunter', themeVars: { bg: '--theme-bg', panel: '--theme-panel', line: '--theme-line', white: '--theme-text', muted: '--theme-muted', cyan: '--theme-accent', purple: '--theme-secondary', acid_green: '--theme-success', orange: '--theme-warning', hot_pink: null, red: null } });
  const CHOOSER_KIT = 'https://cybercoretech.github.io/kit/';
  if (!document.querySelector('link[data-ccx-css]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = `${CHOOSER_KIT}chooser.css`; css.dataset.ccxCss = '';
    document.head.append(css);
  }
  import(`${CHOOSER_KIT}chooser.js`).catch(e => console.warn('Cybercore theme chooser unavailable', e));
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const kid of kids) node.append(kid);
    return node;
  };
  const store = {
    get() { try { return localStorage.getItem(STORE); } catch { return null; } },
    set(v) { try { localStorage.setItem(STORE, v); } catch { /* private mode: keep the choice for this page only */ } },
  };

  // ── mdBook pages get the same header, footer and dialogs ─────────────────
  const isBook = !!document.getElementById('mdbook-sidebar');
  // mdBook 0.5 declares path_to_root with const, so it isn't on window.
  // eslint-disable-next-line no-undef
  const toRoot = isBook ? (typeof path_to_root === 'string' ? path_to_root : '') : './';
  const landing = isBook ? `${toRoot}../` : './';
  const manual = isBook ? toRoot : './docs/';

  function headerMarkup() {
    return `
      <a class="brand-lockup" href="${landing}" aria-label="Darkflow home"><span class="brand-mark">&lt;DF&gt;</span><span class="brand-name">DARKFLOW</span><span class="brand-divider"></span><span class="brand-caption">FIELD MANUAL</span></a>
      <nav class="main-nav" aria-label="Main navigation"><a href="${landing}#system">SYSTEM</a><a href="${landing}#signals">SIGNALS</a><a href="${manual}">FIELD MANUAL</a><a href="https://github.com/${REPO}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a></nav>
      <cybercore-theme-chooser adopt><button class="theme-trigger" type="button">Hunter</button></cybercore-theme-chooser>
      <button class="mobile-menu" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>`;
  }


  if (isBook) {
    document.body.classList.add('mdbook-page');
    // Inside mdBook's page column: its sidebar is fixed to the window's left
    // edge from the very top, so a header above everything would cover it.
    const header = el('header', { class: 'site-header' });
    header.innerHTML = headerMarkup();
    const column = $('#mdbook-page-wrapper .page') || $('#mdbook-page-wrapper');
    if (column) column.prepend(header); else document.body.prepend(header);
    const footer = el('footer', { class: 'site-footer', 'data-site-footer': '' });
    const page = $('#mdbook-content') || $('#content') || document.body;
    page.append(footer);
  }

  // ── dialogs and navigation ────────────────────────────────────────────────
  function wireDialogs() {
    $$('dialog').forEach(d => {
      d.addEventListener('click', e => { if (e.target === d) d.close(); });
      $$('[data-dialog-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
    });
    $$('.mobile-menu').forEach(btn => btn.addEventListener('click', () => {
      const header = btn.closest('.site-header');
      const open = header.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', String(open));
    }));
    $$('.main-nav a').forEach(a => a.addEventListener('click', () => {
      const header = a.closest('.site-header');
      header?.classList.remove('nav-open');
      header?.querySelector('.mobile-menu')?.setAttribute('aria-expanded', 'false');
    }));
  }

  // ── footer: the universal Cybercore contact block ───────────────────────
  // Every Cybercore site loads <cybercore-contact> from the org site's kit;
  // it reads /data/contact.json there, so contact details change in one place.
  // The mailto inside the tag is the offline fallback.
  const KIT = 'https://cybercoretech.github.io/kit/contact.js';
  function renderFooters() {
    const holders = $$('[data-site-footer]');
    if (!holders.length) return;
    const ext = (href, text) => el('a', { href, text, target: '_blank', rel: 'noopener noreferrer' });
    for (const f of holders) {
      f.textContent = '';
      const contact = el('cybercore-contact', { repo: 'darkflow' }, el('a', { href: 'mailto:dev@cybercoretech.net', text: 'dev@cybercoretech.net' }));
      const band = el('section', { class: 'contact-band', 'aria-label': 'Contact Cybercore Tech' }, el('div', { class: 'contact-wrap' }, contact));
      const bottom = el('div', { class: 'footer-bottom' },
        el('span', { text: `CYBERCORE TECH / DARKFLOW / © ${new Date().getFullYear()}` }),
        el('nav', { 'aria-label': 'Footer' },
          el('a', { href: manual, text: 'FIELD MANUAL' }),
          ext(`https://github.com/${REPO}/blob/main/docs/SECURITY.md`, 'SECURITY'),
          ext(`https://github.com/${REPO}`, 'SOURCE')));
      f.append(el('div', { class: 'footer-divider', 'aria-hidden': 'true' }), band, bottom);
    }
    if (!document.querySelector(`script[src="${KIT}"]`)) document.head.append(el('script', { type: 'module', src: KIT }));
  }

  // ── signal cards (landing page) ───────────────────────────────────────────
  const live = { repo: null, run: null, repoError: false, runError: false };
  const fmtDate = iso => iso ? new Date(iso).toISOString().slice(0, 10) : '—';
  const ago = iso => {
    if (!iso) return '';
    const d = Math.round((Date.now() - new Date(iso)) / 86400000);
    return d <= 0 ? 'TODAY' : d === 1 ? '1 DAY AGO' : `${d} DAYS AGO`;
  };

  async function fetchSignals() {
    if (!$('#signals-grid')) return;
    const gh = path => fetch(`https://api.github.com/repos/${REPO}${path}`, { headers: { Accept: 'application/vnd.github+json' } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
    const [repo, runs] = await Promise.allSettled([gh(''), gh('/actions/runs?branch=main&per_page=1')]);
    if (repo.status === 'fulfilled') {
      live.repo = repo.value;
      $('#repo-stars').textContent = `${live.repo.stargazers_count} / ${live.repo.forks_count} / ${live.repo.open_issues_count}`;
      $('#repo-updated').textContent = `LAST PUSH ${ago(live.repo.pushed_at)}`;
    } else {
      live.repoError = true;
      $('#repo-stars').textContent = 'OFFLINE';
      $('#repo-updated').textContent = 'GITHUB API UNAVAILABLE';
    }
    const run = runs.status === 'fulfilled' ? runs.value.workflow_runs?.[0] : null;
    if (run) {
      live.run = run;
      $('#ci-status').textContent = run.status !== 'completed' ? 'RUNNING' : (run.conclusion || 'UNKNOWN').toUpperCase();
    } else {
      live.runError = true;
      $('#ci-status').textContent = 'UNAVAILABLE';
    }
  }

  const metric = (label, value) => el('div', {}, el('small', { text: label }), el('strong', { text: String(value) }));
  const block = (title, text) => { const b = el('div', { class: 'info-block' }); b.append(el('strong', { text: `${title} ` }), text); return b; };
  const link = (href, text) => el('a', { class: 'info-link', href, text, target: '_blank', rel: 'noopener noreferrer' });

  const MODALS = {
    'project-modal': () => ({
      kicker: 'DARKFLOW / PROJECT', eyebrow: 'RELEASE 0.1.0', title: 'Control panel prototype',
      body: [
        el('div', { class: 'info-metrics' }, metric('VERSION', '0.1.0'), metric('SHELL', 'TAURI 2'), metric('CORE', 'RUST')),
        block('Works today:', 'project inspection and darkflow.conf parsing, reviewed request records, session-local telemetry, and detached proposal worktrees bound to a captured commit. Dirty source trees are blocked by default; the original tree is never modified.'),
        block('Not built yet:', 'running an agent, executing configured checks, path-scope enforcement, diff review, and applying patches. Darkflow cannot edit project source today.'),
        link(`https://github.com/${REPO}/blob/main/WORKLIST.md`, 'IMPLEMENTATION WORKLIST ↗'),
      ],
    }),
    'repo-modal': () => {
      const r = live.repo;
      if (!r) return { kicker: 'DARKFLOW / REPOSITORY', eyebrow: 'GITHUB', title: 'Repository', body: [block('Unavailable:', live.repoError ? 'GitHub\'s public API did not answer (rate limit or offline). Nothing is cached or invented here.' : 'Still loading…'), link(`https://github.com/${REPO}`, 'OPEN ON GITHUB ↗')] };
      return {
        kicker: 'DARKFLOW / REPOSITORY', eyebrow: 'LIVE FROM GITHUB', title: r.full_name,
        body: [
          el('div', { class: 'info-metrics' }, metric('STARS', r.stargazers_count), metric('FORKS', r.forks_count), metric('OPEN ISSUES', r.open_issues_count)),
          el('div', { class: 'info-metrics' }, metric('DEFAULT BRANCH', r.default_branch), metric('LAST PUSH', fmtDate(r.pushed_at)), metric('LICENSE', r.license?.spdx_id || '—')),
          block('Source:', 'read by your browser from api.github.com when this page loaded.'),
          link(r.html_url, 'OPEN REPOSITORY ↗'),
        ],
      };
    },
    'ci-modal': () => {
      const run = live.run;
      if (!run) return { kicker: 'DARKFLOW / CI', eyebrow: 'GITHUB ACTIONS', title: 'Checks', body: [block('Unavailable:', live.runError ? 'No workflow run could be read from GitHub right now.' : 'Still loading…'), link(`https://github.com/${REPO}/actions`, 'OPEN ACTIONS ↗')] };
      return {
        kicker: 'DARKFLOW / CI', eyebrow: 'LATEST RUN ON MAIN', title: run.name,
        body: [
          el('div', { class: 'info-metrics' }, metric('RESULT', run.status !== 'completed' ? 'RUNNING' : (run.conclusion || '—').toUpperCase()), metric('COMMIT', run.head_sha.slice(0, 7)), metric('STARTED', fmtDate(run.run_started_at || run.created_at))),
          block('Covers:', 'frontend type-check and build, Rust formatting, and the Rust test suite.'),
          link(run.html_url, 'OPEN THIS RUN ↗'),
        ],
      };
    },
    'privacy-modal': () => ({
      kicker: 'DARKFLOW / TELEMETRY', eyebrow: 'LOCAL ONLY', title: 'What is measured, and where it stays',
      body: [
        block('In the app:', 'the prototype records a small set of UI and session events (including worktree preparation and discard) in memory on your machine. It never uploads project names, paths, source, prompts, diffs or command output.'),
        block('Planned, not collected yet:', 'proposal totals, check outcomes and durations, provider health and changed-line counts. They need the execution engine, which is not connected.'),
        block('On this website:', 'no analytics and no cookies. Your theme choice is stored in this browser only. The repository and CI cards are fetched from GitHub by your browser.'),
        link(`https://github.com/${REPO}/blob/main/docs/TELEMETRY.md`, 'TELEMETRY POLICY ↗'),
      ],
    }),
  };

  function wireSignalCards() {
    const dlg = $('#info-dialog');
    if (!dlg) return;
    $$('[data-modal]').forEach(card => card.addEventListener('click', () => {
      const m = MODALS[card.dataset.modal]?.();
      if (!m) return;
      $('#info-kicker').textContent = m.kicker;
      $('#info-eyebrow').textContent = m.eyebrow;
      $('#info-title').textContent = m.title;
      const box = $('#info-content');
      box.textContent = '';
      box.append(...m.body);
      dlg.showModal();
    }));
  }

  // ── boot ──────────────────────────────────────────────────────────────────
  wireDialogs();
  wireSignalCards();
  renderFooters();
  fetchSignals();
})();
