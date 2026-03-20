<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/cf6303ef-bea8-4c29-b23d-4362d1891b71

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the server environment variables in [.env.local](.env.local):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
   - `TBA_API_KEY`
   - Optional: `PORT`
3. Apply the database schema in your Supabase project:
   - Open Supabase SQL Editor and run [schema.sql](schema.sql)
4. Run the app:
   `npm run dev`

## Supabase Notes

- Backend persistence now uses Supabase Postgres via server-side service-role access.
- Existing API contracts remain unchanged (`/api/sync`, `/api/data`).
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.

## Production Build And Start

1. Build frontend and server:
   `npm run build`
2. Start the compiled server:
   `npm run start`
