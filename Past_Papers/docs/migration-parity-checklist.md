# Django to Supabase Migration Parity Checklist

## Current frontend dependency map

- `auth.signup` -> `POST /signup/`
- `auth.login` -> `POST /login/`
- `auth.logout` -> `POST /logout/`
- `profile.get` -> `GET /profile/`
- `profile.update` -> `PATCH /profile/`
- `notes.list/upload/update/delete` -> `/notes/*`
- `pastPapers.list/upload/update/delete` -> `/past-papers/*`
- `chatbot.send` -> `POST /chatbot/`
- `paperGen.generate` -> `POST /generate-paper/`
- `paperGen.downloadPdf` -> `POST /generate-paper/pdf/`
- `videos.search` -> `GET /videos/?q=...`
- `chatSessions.list/create/get/delete` -> `/chat/sessions/*`
- `queries.submit/list/resolve` -> `/queries/*`

## New target contract

- Keep response shapes as close as possible to avoid broad UI rewrites.
- Replace all backend calls with frontend-hosted Vercel API routes (`/api/*`).
- Use Supabase for auth, database, and storage.

## Route migration map

- `/signup/` -> `/api/auth/signup`
- `/login/` -> `/api/auth/login`
- `/logout/` -> `/api/auth/logout`
- `/profile/` -> `/api/profile`
- `/notes/` -> `/api/notes`
- `/notes/upload/` -> `/api/notes/upload`
- `/notes/:id/` -> `/api/notes/:id`
- `/past-papers/` -> `/api/past-papers`
- `/past-papers/upload/` -> `/api/past-papers/upload`
- `/past-papers/:id/` -> `/api/past-papers/:id`
- `/chatbot/` -> `/api/chatbot`
- `/generate-paper/` -> `/api/generate-paper`
- `/generate-paper/pdf/` -> `/api/generate-paper/pdf`
- `/videos/` -> `/api/videos`
- `/chat/sessions/` -> `/api/chat/sessions`
- `/chat/sessions/:id/` -> `/api/chat/sessions/:id`
- `/queries/submit/` -> `/api/queries/submit`
- `/queries/` -> `/api/queries`
- `/queries/:id/resolve/` -> `/api/queries/:id/resolve`

## Legacy removal candidates

- Entire `backend/` folder once migration parity is validated.
- Any hardcoded secrets and API keys in tracked files.
- Django-specific token refresh flow in frontend service client.

