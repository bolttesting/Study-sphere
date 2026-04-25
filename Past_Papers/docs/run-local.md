# Run StudySphere Locally

This guide shows the exact commands to run the app locally with both:
- React frontend
- API routes (`/api/*`) from `api/index.js`

---

## 1) Open project folder

```powershell
cd I:\CHATBOT_Pastpapers\CHATBOT_Pastpapers\Past_Papers
```

---

## 2) Install dependencies (first time only)

```powershell
npm install
```

---

## 3) Create/update environment file

Make sure `.env.local` exists in project root and has:

```env
REACT_APP_API_URL=/api

SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant

YOUTUBE_API_KEY=your_youtube_key
```

> Keep secrets only in `.env.local` (never commit it).

---

## 4) Run app (recommended: Vercel dev)

Use this method because it serves both frontend and `/api` locally.

### PowerShell commands

```powershell
# Load .env.local vars into current shell (PowerShell)
$lines = Get-Content ".env.local"
foreach ($line in $lines) {
  if ($line -match '^\s*([^#][^=]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
  }
}

# Start full local runtime
npx vercel dev --yes
```

When ready, terminal shows something like:
- `Ready! Available at http://localhost:3000` (or `3001/3002/...`)

Open that URL in browser.

---

## 5) If port changes

If 3000 is busy, Vercel auto-picks next port (3001, 3002, 3003...).

Always use the exact `localhost:<port>` shown in terminal.

---

## 6) Stop and restart

### Stop
- Press `Ctrl + C` in the terminal running `vercel dev`

### Restart
Run step 4 commands again.

---

## 7) Quick health checks

### Frontend check
Open:

```text
http://localhost:<port>
```

### API check
In a separate terminal:

```powershell
node -e "fetch('http://localhost:<port>/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'x',password:'y'})}).then(async r=>{console.log(r.status);console.log(await r.text())})"
```

Expected:
- `401` with `"Invalid login credentials"` (this means route is working)

---

## 8) Common issues

### A) `Cannot POST /api/auth/login` or `Not Found`
- You started with `npm start` only.
- Fix: run with `npx vercel dev --yes` (step 4).

### B) `Missing SUPABASE_URL...`
- Env vars not loaded in shell.
- Fix: run the PowerShell env loader from step 4 before `vercel dev`.

### C) Admin PDF upload fails (`formidable is not a function`)
- Fixed in current codebase.
- Restart local server after pulling latest changes.

### D) PDF opens empty tab
- Usually auth/file-route issue.
- Fixed with protected file opening flow in current codebase.

---

## 9) Optional: production build check

```powershell
npm run build
```

---

## 10) Optional: tests

```powershell
npm test -- --watchAll=false
```

