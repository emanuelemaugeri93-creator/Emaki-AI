/* Emaki AI core: shared sign-in + license check for every edition.
 *
 * Needs the Supabase JS library loaded first:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="emaki-core.js"></script>
 *
 * The URL and the publishable key below are PUBLIC by design. What protects the data is
 * row level security on the server. NEVER put a secret / service_role key in this file.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://uqzbdnyrutgxeuspugjv.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_WaHXvoK2FUM-t6lAwsYDhQ_FikkmksM';

  var EDITIONS = {
    creator: { label: 'Emaki AI Creator', file: 'emaki-ai-creator-edition.html' },
    studio:  { label: 'Emaki AI Studio',  file: 'emaki-ai-studio-edition.html' },
    master:  { label: 'Emaki AI Master',  file: 'emaki-ai-master-edition.html' },
    titan:   { label: 'Emaki AI Titan',   file: 'emaki-ai-titan-edition.html' }
  };

  var client = null;
  function sb() {
    if (!client) {
      if (!window.supabase || !window.supabase.createClient) {
        throw new Error('Supabase library failed to load');
      }
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Implicit flow: the magic link also works when opened on another device/browser.
          flowType: 'implicit'
        }
      });
    }
    return client;
  }

  async function getSession() {
    var r = await sb().auth.getSession();
    return r.data.session || null;
  }

  async function sendLoginLink(email) {
    var r = await sb().auth.signInWithOtp({
      email: String(email || '').trim().toLowerCase(),
      options: {
        emailRedirectTo: new URL('index.html', window.location.href).href,
        shouldCreateUser: true
      }
    });
    if (r.error) throw r.error;
  }

  async function signOut() {
    try { await sb().auth.signOut(); } catch (e) { /* ignore */ }
    window.location.replace('index.html');
  }

  // Editions the signed-in user has an ACTIVE license for (decided by the server).
  async function myEditions() {
    var r = await sb().rpc('my_editions');
    if (r.error) throw r.error;
    return (r.data || []).map(String);
  }

  function go(url) { window.location.replace(url); }

  function showFatal(message) {
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#100c0a;color:#fff4e7;' +
      'display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;' +
      'font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;';
    el.innerHTML = '<div style="max-width:420px"><div style="font-size:22px;font-weight:800;color:#d4a63a;margin-bottom:10px">Emaki AI</div>' +
      '<p style="margin:0 0 16px"></p><a href="index.html" style="color:#f0c879">Back to sign in</a></div>';
    el.querySelector('p').textContent = message;
    document.body.appendChild(el);
  }

  // Call at the top of an edition page. Resolves true only if the user may use `edition`.
  // Fails closed: any error keeps the app hidden.
  async function guard(edition) {
    // Local preview: files opened from disk (file://) or a local dev server skip sign-in so the
    // author can test edits. The public site (https) always requires login + license.
    var host = window.location.hostname;
    if (window.location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      state.email = 'Local preview';
      state.edition = edition;
      state.local = true;
      console.info('[EmakiAuth] local preview: sign-in skipped');
      return true;
    }
    try {
      var s = await getSession();
      if (!s) { go('index.html?next=' + encodeURIComponent(edition)); return false; }
      var owned = await myEditions();
      if (owned.indexOf(edition) === -1) { go('index.html?need=' + encodeURIComponent(edition)); return false; }
      state.email = s.user && s.user.email || '';
      state.edition = edition;
      return true;
    } catch (e) {
      console.error('[EmakiAuth] guard failed', e);
      showFatal('We could not verify your access. Check your connection and reload the page.');
      return false;
    }
  }

  var state = { email: '', edition: '', local: false };

  // Adds "signed in as ... / Sign out" at the bottom of the API Keys panel.
  function mountAccount() {
    var body = document.querySelector('#sidePanelApi .panel-body');
    if (!body || document.getElementById('emakiAccountRow')) return;
    var row = document.createElement('div');
    row.id = 'emakiAccountRow';
    row.style.cssText = 'margin-top:auto;padding-top:12px;border-top:1px solid var(--border);' +
      'display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--text-muted);';
    var who = document.createElement('span');
    who.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    who.textContent = state.email || 'Signed in';
    var btn = document.createElement('button');
    btn.className = 'link-danger';
    btn.textContent = 'Sign out';
    btn.addEventListener('click', signOut);
    row.appendChild(who);
    if (!state.local) row.appendChild(btn);
    body.appendChild(row);
  }

  window.EmakiAuth = {
    EDITIONS: EDITIONS,
    getSession: getSession,
    sendLoginLink: sendLoginLink,
    signOut: signOut,
    myEditions: myEditions,
    guard: guard,
    mountAccount: mountAccount
  };
})();
