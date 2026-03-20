<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy on Vercel

This project is now frontend-only (Vite + React) and is ready for Vercel static hosting.

View your app in AI Studio: https://ai.studio/apps/cf6303ef-bea8-4c29-b23d-4362d1891b71

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the frontend environment variables in [.env.local](.env.local):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `TBA_API_KEY`
   - `GEMINI_API_KEY`
3. Apply the database schema in your Supabase project:
   - Open Supabase SQL Editor and run [schema.sql](schema.sql)
4. Run the app:
   `npm run dev`

## Vercel Deployment

1. Import the repository into Vercel.
2. Framework preset: `Vite`.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add the same `VITE_*` environment variables in Vercel Project Settings.
   - Also add `TBA_API_KEY` and `GEMINI_API_KEY` for Vercel Functions.

## Notes

- Supabase is accessed directly from the browser with your publishable/anon key.
- TBA and Gemini calls are routed through Vercel Functions so API keys stay server-side.
- The included [schema.sql](schema.sql) allows anon and authenticated access so the app works without login; tighten these policies before multi-team production use.

## Production Build

1. Build frontend:
   `npm run build`
