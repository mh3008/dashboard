const SUPABASE_URL      = 'https://inxmxqlfkivryhhxgtnd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlueG14cWxma2l2cnloaHhndG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzgzMDksImV4cCI6MjA5NjI1NDMwOX0.TohwbcDQqLbT1f2ol1_Yw7vpa1lJBB-Z0-MnrRaKq7E';

// Voice/Shortcut values arrive messy: "45 ms", "52,0", "7h 12m", "11:48 PM",
// "2026-10-11T07:12:00+01:00". Each cleaner returns null when it can't make sense of it.

function cleanNum(raw) {
  let s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.indexOf('.') < 0) s = s.replace(',', '.');
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function cleanTime(raw) {
  let s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  const iso = s.match(/t(\d{1,2}):(\d{2})/);           // ISO datetime → take the clock time as given
  if (iso) s = iso[1] + ':' + iso[2];
  const m = s.match(/(\d{1,2})\s*[:.h]\s*(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/) || s.match(/(\d{1,2})()\s*(am|pm)/);
  if (!m) return null;
  let h = parseInt(m[1], 10), min = parseInt(m[2] || '0', 10);
  const ap = (m[3] || '').replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

function cleanMins(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  const hm = s.match(/(\d+(?:[.,]\d+)?)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m)?/);
  if (hm) return Math.round(parseFloat(hm[1].replace(',', '.')) * 60 + parseInt(hm[2] || '0', 10));
  const colon = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (colon) return parseInt(colon[1], 10) * 60 + parseInt(colon[2], 10);
  const n = cleanNum(s);
  if (n == null) return null;
  if (/sec|\bs\b/.test(s)) return Math.round(n / 60);
  return Math.round(n);
}

function inRange(v, lo, hi) { return v != null && v >= lo && v <= hi ? v : null; }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = req.query;
  const dateMatch = String(q.date ?? '').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!dateMatch) return res.status(400).json({ error: 'date required as YYYY-MM-DD', raw: q.date });
  const cleanDate = dateMatch[1] + '-' + dateMatch[2].padStart(2, '0') + '-' + dateMatch[3].padStart(2, '0');

  const incoming = {
    bed:         cleanTime(q.bed),
    wake:        cleanTime(q.wake),
    asleep_mins: inRange(cleanMins(q.asleep_mins), 0, 1080),
    deep_mins:   inRange(cleanMins(q.deep_mins), 0, 600),
    rem_mins:    inRange(cleanMins(q.rem_mins), 0, 600),
    hrv:         inRange(cleanNum(q.hrv), 5, 300),
    rhr:         inRange(cleanNum(q.rhr), 25, 150),
  };
  if (incoming.hrv != null) incoming.hrv = Math.round(incoming.hrv * 10) / 10;
  if (incoming.rhr != null) incoming.rhr = Math.round(incoming.rhr);

  const rejected = {};
  Object.keys(incoming).forEach(k => {
    if (incoming[k] == null && q[k] != null && String(q[k]).trim() !== '') rejected[k] = q[k];
  });
  console.log('health', cleanDate, 'raw:', q, '→', incoming);

  const key = 'health:' + cleanDate;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  };

  // merge onto any existing row so a partial resend never wipes earlier fields
  let value = {};
  try {
    const cur = await fetch(SUPABASE_URL + '/rest/v1/daily_data?select=value&key=eq.' + encodeURIComponent(key), { headers });
    if (cur.ok) {
      const rows = await cur.json();
      if (rows[0] && rows[0].value && typeof rows[0].value === 'object') value = rows[0].value;
    }
  } catch (err) { /* fall through with an empty base */ }
  Object.keys(incoming).forEach(k => { if (incoming[k] != null) value[k] = incoming[k]; });
  value.synced_at = new Date().toISOString();

  let sbRes;
  try {
    sbRes = await fetch(SUPABASE_URL + '/rest/v1/daily_data', {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ key, value }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Supabase', details: err.message });
  }

  if (!sbRes.ok) {
    const errText = await sbRes.text();
    return res.status(502).json({ error: 'Supabase error', status: sbRes.status, details: errText });
  }

  return res.status(200).json({ ok: true, date: cleanDate, saved: value, rejected });
}
