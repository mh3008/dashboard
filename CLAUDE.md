# Dashboard — CLAUDE.md

## What this is
M's personal life dashboard. Single-file vanilla HTML/JS app deployed on Vercel. Lives on his left portrait monitor all day. Tracks daily execution — supps, gym, fuel, sleep, hygiene, steps, todos, streaks.

## Stack
- Single file: dashboard.html (all HTML, CSS, JS in one file)
- Backend: Supabase (inxmxqlfkivryhhxgtnd.supabase.co)
- Data: daily_data table, key-value store with prefixes (supps:, training:, sleep:, fuel:, goals:, body:, log:, hygiene:, todos:, steps:)
- Step sync: iOS Shortcuts → api/steps.js (Vercel serverless function)
- Icons: Tabler icons
- Deployed at: dashboard-mh3308.vercel.app

## Design
- Read the current CSS variables in dashboard.html for the live colour theme — don't assume colours
- Sharp 4px border radius, premium gaming aesthetic
- Single-column portrait layout
- Check the actual file for current panel order — it changes

## Rules
- ALWAYS read dashboard.html before making changes — never work from memory
- Don't add features or panels M didn't ask for
- Don't break existing functionality when adding new stuff
- Keep everything in the single dashboard.html file
- Use CSS custom properties (variables) for all colours
- Use Tabler icons, never emoji

## Deploy
- git add, commit, push
- Then SEPARATELY: cd D:\dashboard then vercel --prod (never chain with &&)
- After EVERY deploy: Deployment Protection must be manually disabled at vercel.com/mh3308/dashboard/settings

## Common patterns
- Store data: storeSet('prefix:YYYY-MM-DD', jsonData)
- Read data: storeGet('prefix:YYYY-MM-DD')
- Supabase debug in browser: ?select=key,value&key=like.prefix*&apikey=ANON_KEY
- Upsert header: Prefer: resolution=merge-duplicates
