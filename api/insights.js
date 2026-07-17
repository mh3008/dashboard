export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { data } = req.body || {};
  if (!data) return res.status(400).json({ error: 'Missing data' });

  let dataText = '';
  for (const [category, entries] of Object.entries(data)) {
    const entryPairs = Object.entries(entries);
    dataText += `\n--- ${category} (${entryPairs.length} entries) ---\n`;
    for (const [date, value] of entryPairs) {
      dataText += `${date}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
    }
  }

  const systemPrompt =
    'You are an AI coach analyzing personal tracking data for a 19-year-old CS student who trains daily ' +
    '(anterior/posterior split, 2 sets, 0-1 RIR, 6-8 reps), plays football weekly (centre mid), walks 15k steps/day, ' +
    'full supplement stack (creatine, mag glycinate, D3+K2, zinc+copper, vitamin C, taurine, NAC, fish oil). ' +
    'Schedule 10am-2am. Cannabis 1x daily 10-12pm. High protein diet — chicken, OJ, milk.';

  const userPrompt =
    dataText +
    '\n\nAnalyze this data and return exactly 5-7 insights as a JSON array. Each insight must have:\n' +
    '- title: string (under 10 words)\n' +
    '- body: string (1-2 sentences with specific numbers where available)\n' +
    '- category: one of "supps" | "training" | "sleep" | "fuel" | "goals" | "body" | "log"\n' +
    '- type: one of "pattern" | "warning" | "win" | "suggestion"\n\n' +
    'Return only the JSON array, no other text.';

  let apiRes;
  try {
    apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Anthropic API', details: err.message });
  }

  if (!apiRes.ok) {
    const errText = await apiRes.text();
    return res.status(502).json({ error: 'Anthropic API error', details: errText });
  }

  const result = await apiRes.json();
  const raw = (result.content?.[0]?.text || '').trim();

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return res.status(502).json({ error: 'Failed to parse insights from response', raw });
  }

  let insights;
  try {
    insights = JSON.parse(jsonMatch[0]);
  } catch (err) {
    return res.status(502).json({ error: 'Invalid JSON in response', details: err.message });
  }

  return res.status(200).json(insights);
}
