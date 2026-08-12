/* ============================================================
   LIFE OS — realtime cross-device sync
   Mirrors localStorage <-> Supabase (app_state table) and keeps
   every device live via realtime. Whole life-state under ONE row
   so the Home page can read every app's data for the stat rings.

   Include on every page, AFTER the supabase CDN:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="sync.js" defer></script>

   Auto-inits. When remote state arrives it fires a window event
   'lo-sync-applied' — pages listen to that to re-render.
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://inxmxqlfkivryhhxgtnd.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlueG14cWxma2l2cnloaHhndG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzgzMDksImV4cCI6MjA5NjI1NDMwOX0.TohwbcDQqLbT1f2ol1_Yw7vpa1lJBB-Z0-MnrRaKq7E';

  // one shared row for the whole dashboard
  var APP_KEY = 'mh-life';

  // localStorage key prefixes that get mirrored. Add new app prefixes here
  // as we build pages (they'll then sync automatically).
  var SYNC_PREFIXES = [
    'supps:', 'gym:', 'sleep:', 'hygiene:', 'steps:', 'fuel:', 'body:',
    'goals:', 'todos:', 'streaks:', 'log:',
    'money:', 'trades:', 'buy:', 'subs:',
    'learn:', 'reading:',
    'social:', 'timers:', 'posture:', 'football:',
    'countdowns:', 'weekly:', 'goal_streak_v1',
    'plants:', 'car:'
  ];

  function matches(k) {
    if (!k) return false;
    for (var i = 0; i < SYNC_PREFIXES.length; i++) {
      if (k.indexOf(SYNC_PREFIXES[i]) === 0) return true;
    }
    return false;
  }
  function listKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (matches(k)) out.push(k);
    }
    return out;
  }
  function collect() {
    var out = {};
    listKeys().forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v == null) return;
      try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; }
    });
    return out;
  }

  var supa = null, pushTimer = null, suppress = false, lastJson = null;
  var origSet = localStorage.setItem.bind(localStorage);
  var origRemove = localStorage.removeItem.bind(localStorage);

  localStorage.setItem = function (k, v) {
    origSet(k, v);
    try { if (!suppress && matches(k)) schedulePush(); } catch (e) {}
  };
  localStorage.removeItem = function (k) {
    origRemove(k);
    try { if (!suppress && matches(k)) schedulePush(); } catch (e) {}
  };

  function applyRemote(remote) {
    if (!remote || typeof remote !== 'object') return false;
    suppress = true; var changed = false;
    try {
      Object.keys(remote).forEach(function (k) {
        if (!matches(k)) return;
        var incoming = JSON.stringify(remote[k]);
        if (localStorage.getItem(k) !== incoming) { origSet(k, incoming); changed = true; }
      });
      listKeys().forEach(function (k) {
        if (!(k in remote)) { origRemove(k); changed = true; }
      });
    } finally { suppress = false; }
    if (changed) {
      try { window.dispatchEvent(new CustomEvent('lo-sync-applied')); } catch (e) {}
    }
    return changed;
  }

  function pushNow() {
    if (!supa) return;
    var state = collect(), json = JSON.stringify(state);
    if (json === lastJson) return;
    supa.from('app_state')
      .upsert({ key: APP_KEY, data: state, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .then(function (r) { if (!r.error) lastJson = json; });
  }
  function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 250); }

  function flushOnUnload() {
    var state = collect(), json = JSON.stringify(state);
    if (json === lastJson) return;
    try {
      fetch(SUPABASE_URL + '/rest/v1/app_state?on_conflict=key', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ key: APP_KEY, data: state, updated_at: new Date().toISOString() }),
        keepalive: true
      }).catch(function () {});
      lastJson = json;
    } catch (e) {}
  }

  function init() {
    if (!window.supabase) { console.warn('[sync] supabase-js not loaded'); return; }
    supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    supa.from('app_state').select('data').eq('key', APP_KEY).maybeSingle()
      .then(function (res) {
        if (!res.error && res.data && res.data.data && Object.keys(res.data.data).length) {
          lastJson = JSON.stringify(res.data.data);
          applyRemote(res.data.data);
        } else if (Object.keys(collect()).length) {
          schedulePush();
        }
      });

    supa.channel('app_state_' + APP_KEY)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'app_state', filter: 'key=eq.' + APP_KEY },
        function (payload) {
          if (!payload.new || !payload.new.data) return;
          var incoming = JSON.stringify(payload.new.data);
          if (incoming === lastJson) return;
          lastJson = incoming;
          applyRemote(payload.new.data);
        })
      .subscribe();

    window.addEventListener('beforeunload', flushOnUnload);
    window.addEventListener('pagehide', flushOnUnload);
    window.addEventListener('storage', function (e) { if (e.key && matches(e.key)) schedulePush(); });
  }

  // expose for debugging / manual push
  window.LO_SYNC = { push: function () { schedulePush(); }, state: collect };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
