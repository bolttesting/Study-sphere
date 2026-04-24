# StudySphere (Vercel + Supabase)

This app now runs as:

- React frontend on Vercel
- Serverless API routes in `api/`
- Supabase for Auth, Postgres, and Storage

## Environment Variables

Copy `.env.example` values into Vercel project environment variables.

- `REACT_APP_API_URL` (use `/api`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `YOUTUBE_API_KEY`

## Supabase Setup

1. Open Supabase SQL editor.
2. Run `infra/supabase/schema.sql`.
3. Verify buckets `notes` and `past-papers` were created.

## Development

- `npm install`
- `npm start`
- Frontend runs on [http://localhost:3000](http://localhost:3000)

## Build/Validation

- `npm run build` (production build check)
- `npm test -- --watchAll=false` (basic regression check)

## Deployment (Vercel)

1. Import `Past_Papers` directory as Vercel project.
2. Add environment variables from `.env.example`.
3. Deploy. Vercel serves:
   - Static app (CRA build output)
   - API routes from `api/*`

## Manual Smoke Checklist

- Signup, login, logout
- Student dashboard tabs
- Chatbot general + RAG mode, session history
- Query escalation and admin query resolve
- Notes upload/list/edit/delete
- Past papers upload/list/edit/delete
- Generate paper + PDF download
- Video search
