const SUPABASE_URL      = 'https://inxmxqlfkivryhhxgtnd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlueG14cWxma2l2cnloaHhndG5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzgzMDksImV4cCI6MjA5NjI1NDMwOX0.TohwbcDQqLbT1f2ol1_Yw7vpa1lJBB-Z0-MnrRaKq7E';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { steps: rawSteps, date } = req.query;

  const cleaned = String(rawSteps ?? '').replace(/[^\d.]/g, '');
  console.log('steps raw:', rawSteps, '→ cleaned:', cleaned);
  const parsedSteps = parseFloat(cleaned);
  if (!cleaned || isNaN(parsedSteps) || parsedSteps < 0) {
    return res.status(400).json({ error: 'Invalid steps value', raw: rawSteps });
  }

  const dateMatch = String(date ?? '').match(/(\d{4}-\d{2}-\d{2})/);
  const cleanDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

  const key = 'steps:' + cleanDate;

  let sbRes;
  try {
    sbRes = await fetch(SUPABASE_URL + '/rest/v1/daily_data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key, value: parsedSteps }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Supabase', details: err.message });
  }

  if (!sbRes.ok) {
    const errText = await sbRes.text();
    return res.status(502).json({ error: 'Supabase error', status: sbRes.status, details: errText });
  }

  return res.status(200).json({ ok: true, steps: parsedSteps, date: cleanDate, rawSteps: req.query.steps, rawDate: req.query.date });
}
