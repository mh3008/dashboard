/* ============================================================
   LIFE OS — Helio health data (Zepp → Apple Health → Shortcut → api/health)
   Rows live in Supabase daily_data as 'health:YYYY-MM-DD'. This is
   read-only on the page side, so it is NOT a sync.js prefix — it's
   fetched here and cached locally under 'healthcache'.

   LO_HEALTH.load(cb)       fetch last 40 days, cb(map) (cached map first)
   LO_HEALTH.map()          { 'YYYY-MM-DD': {bed,wake,asleep_mins,deep_mins,rem_mins,hrv,rhr} }
   LO_HEALTH.readiness(d)   { state:'green'|'amber'|'red'|'calibrating'|'none', verdict, n, ... }
   ============================================================ */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://inxmxqlfkivryhhxgtnd.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlueG14cWxma2l2cnloaHhndG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzgzMDksImV4cCI6MjA5NjI1NDMwOX0.TohwbcDQqLbT1f2ol1_Yw7vpa1lJBB-Z0-MnrRaKq7E';
  var CACHE_KEY = 'healthcache';
  var BASE_N = 7;          // nights needed for a baseline
  var LOOKBACK = 14;       // how far back to look for those nights

  function pad2(n) { return String(n).padStart(2, '0'); }
  function ds(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function shift(date, days) { var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + days); return ds(d); }

  var cache = {};
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { cache = {}; }

  function load(cb) {
    if (cb) cb(cache);
    var since = shift(ds(new Date()), -40);
    fetch(SUPABASE_URL + '/rest/v1/daily_data?select=key,value&key=gte.' + encodeURIComponent('health:' + since) + '&key=lte.' + encodeURIComponent('health:9999'),
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows) return;
        var next = {};
        rows.forEach(function (r) { if (r.value && typeof r.value === 'object') next[r.key.slice(7)] = r.value; });
        var changed = JSON.stringify(next) !== JSON.stringify(cache);
        cache = next;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
        if (changed && cb) cb(cache);
      })
      .catch(function () {});
  }

  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }

  // HRV down / RHR up vs the 7 most recent previous nights = less recovered.
  function readiness(date) {
    var today = cache[date];
    var prior = [];
    for (var i = 1; i <= LOOKBACK && prior.length < BASE_N; i++) {
      var r = cache[shift(date, -i)];
      if (r && typeof r.hrv === 'number' && typeof r.rhr === 'number') prior.push(r);
    }
    var has = today && typeof today.hrv === 'number' && typeof today.rhr === 'number';
    if (prior.length < BASE_N) {
      var n = prior.length + (has ? 1 : 0);
      return { state: 'calibrating', n: Math.min(n, BASE_N), verdict: 'calibrating (' + Math.min(n, BASE_N) + '/' + BASE_N + ' nights)' };
    }
    if (!has) return { state: 'none', n: BASE_N, verdict: 'no reading yet today' };
    var bHrv = mean(prior.map(function (r) { return r.hrv; }));
    var bRhr = mean(prior.map(function (r) { return r.rhr; }));
    var dHrv = (today.hrv - bHrv) / bHrv * 100;   // %
    var dRhr = today.rhr - bRhr;                  // bpm
    var state;
    if (dHrv <= -15 || dRhr >= 5 || (dHrv <= -10 && dRhr >= 3)) state = 'red';
    else if (dHrv >= -5 && dRhr <= 2) state = 'green';
    else state = 'amber';
    return {
      state: state, n: BASE_N,
      verdict: state === 'green' ? 'push it' : (state === 'amber' ? 'normal session' : 'back off or rest day'),
      hrv: today.hrv, rhr: today.rhr, baseHrv: bHrv, baseRhr: bRhr, dHrv: dHrv, dRhr: dRhr
    };
  }

  window.LO_HEALTH = { load: load, map: function () { return cache; }, readiness: readiness, shift: shift };
})();
