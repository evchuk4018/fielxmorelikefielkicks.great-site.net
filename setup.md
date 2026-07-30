# FRC Scout Setup Guide

This is the complete setup guide for the FRC Scout application in this repository. It covers:

- installing and running the app locally;
- creating and configuring the Supabase backend;
- finding every Supabase credential the app uses;
- obtaining a The Blue Alliance (TBA) read API key;
- configuring Gemini through Google AI Studio;
- understanding why this app does **not** need a Statbotics API key;
- deploying the Vite frontend and Vercel Functions to Vercel;
- adding environment variables in Vercel;
- completing the first administrator setup;
- troubleshooting common setup failures; and
- the security work recommended before using the app with sensitive scouting data.

The guide describes the current code in this repository. If the code changes, re-check the environment-variable names and the `api/` directory before copying an old deployment configuration.

## 1. What this application is

The app is a React/Vite scouting application. It has two parts that deploy together:

1. The browser frontend built by Vite into `dist/`.
2. Server-side Vercel Functions in the `api/` directory.

The browser uses Supabase directly for scouting data, profiles, settings, and storage. The browser never needs to know the TBA or Gemini secret keys. Instead, those requests go through the Vercel Functions in this repository.

The high-level request flow is:

```text
Browser
  ├── Supabase URL + publishable/anon key ───────────────> Supabase database and storage
  ├── /api/tba/* ────────────────────────────────────────> Vercel Function ──> The Blue Alliance
  ├── /api/gemini/* ─────────────────────────────────────> Vercel Function ──> Gemini API
  ├── /api/faceid/* ────────────────────────────────────> Vercel Function ──> Supabase with server key
  └── /api/statbotics/* ─────────────────────────────────> Vercel Function ──> public Statbotics API
```

The app currently includes:

- event and competition profile management;
- pit scouting and pit photos;
- match scouting and match coverage;
- alliance strategy and alliance selection tools;
- raw scouting data and analytics;
- prescouting match video workflows;
- scout profiles and admin moderation;
- password and Face ID scout profile login;
- a shared admin PIN;
- configurable season settings, match questions, scoring rules, and alliance filters;
- a shared field-map upload;
- Gemini-powered CSV import and match-note summaries;
- The Blue Alliance event, team, match, ranking, and match-video data; and
- Statbotics team, season, event, and match analytics.

## 2. Prerequisites

Install the following before starting:

- Git;
- Node.js, preferably a current LTS release (Node 20 or newer is recommended for this project);
- an account on [Supabase](https://supabase.com/);
- an account on [Vercel](https://vercel.com/) if deploying;
- a [The Blue Alliance](https://www.thebluealliance.com/) account if live TBA data is needed; and
- a Google account for [Google AI Studio](https://aistudio.google.com/).

Check that Node and npm are available:

```bash
node --version
npm --version
```

PowerShell users can run the same commands in PowerShell.

## 3. Get the source code

Clone the repository and enter the project directory:

```bash
git clone <your-git-repository-url>
cd fielxmorelikefielkicks.great-site.net
```

If you already have the project folder, just open a terminal at the repository root. The repository root is the folder containing:

- `package.json`;
- `schema.sql`;
- `vite.config.ts`;
- `src/`;
- `api/`; and
- `.env.example`.

Install dependencies:

```bash
npm install
```

The main scripts are:

```bash
npm run dev       # start the Vite development server
npm run build     # create the production build in dist/
npm run preview   # serve the production build locally
npm run lint      # run TypeScript checking without emitting files
```

## 4. Environment variables: the complete list

The repository includes [.env.example](./.env.example). Copy it to `.env.local` for local development:

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS/Linux:

```bash
cp .env.example .env.local
```

Open `.env.local` and replace every placeholder value. The resulting file should have this shape, but never commit real values:

```dotenv
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
VITE_SUPABASE_ANON_KEY="your_supabase_publishable_or_anon_key"
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_secret_or_service_role_key"
TBA_API_KEY="your_tba_read_api_key"
GEMINI_API_KEY="your_gemini_api_key"
```

### Environment-variable reference

| Variable | Required | Used by | What goes here |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Browser; server fallback | The Supabase Project URL, for example `https://abc123.supabase.co`. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Browser | A Supabase publishable key (`sb_publishable_...`) or the legacy `anon` key. The variable name is historical. |
| `SUPABASE_URL` | Recommended/required for server features | Vercel Functions | The same Supabase Project URL, without the `VITE_` prefix. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required for Face ID and server-side team import | Vercel Functions | A Supabase elevated server key: preferably the key compatible with this repository's `@supabase/supabase-js` version. The legacy `service_role` key is the compatibility option. Never expose it. |
| `TBA_API_KEY` | Required for live TBA requests | TBA Vercel Functions and local TBA middleware | The TBA Read API key. |
| `GEMINI_API_KEY` | Required for Gemini features | Gemini Vercel Functions | The Google AI Studio Gemini API key. |
| `DISABLE_HMR` | Optional | Local Vite server | Set to `true` only if you need to disable Vite hot-module replacement. Do not add this to production unless you have a specific reason. |

There is intentionally no `STATBOTICS_API_KEY` in the table. The public Statbotics FRC endpoints used by this project are called without an API key, and the current code does not read a Statbotics key from the environment. More details are in the Statbotics section below.

### Important `VITE_` rule

Vite exposes variables beginning with `VITE_` to browser code. Anyone who can load the deployed site can inspect those values.

That is acceptable for:

- `VITE_SUPABASE_URL`; and
- the Supabase publishable key or legacy anon key, provided the database is protected by appropriate Row Level Security policies.

It is not acceptable for:

- a Supabase secret or `service_role` key;
- `TBA_API_KEY`; or
- `GEMINI_API_KEY`.

Never rename a secret to `VITE_TBA_API_KEY`, `VITE_GEMINI_API_KEY`, or `VITE_SUPABASE_SERVICE_ROLE_KEY`.

### Do not commit local secrets

The repository `.gitignore` ignores `.env*` while explicitly allowing `.env.example`. Keep real credentials only in:

- your local `.env.local` file;
- Vercel Project Settings; or
- a secure secret manager.

If a secret is ever committed, pasted into a public issue, or sent through an untrusted chat, rotate it immediately. Deleting the commit is not enough because Git history may retain it.

## 5. Create the Supabase project

Supabase is the database and object-storage backend for this app.

### 5.1 Create a project

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Sign in or create an account.
3. Select an organization, or create one.
4. Click **New project**.
5. Choose a project name, such as `frc-scout-production`.
6. Choose a strong database password and save it in your password manager. The app does not use the database password directly, but Supabase will need it for administrative database access.
7. Choose a region near the people scouting or near the Vercel Function region you plan to use.
8. Create the project and wait until the database finishes provisioning.

Do not create a separate Supabase project for every event unless you have a strong reason. The app is designed to hold multiple competition profiles and seasons inside one project.

### 5.2 Find the Supabase Project URL

There are two reliable places to find the URL:

- open the project's **Connect** dialog and copy the Project URL; or
- open **Project Settings → API Keys** and copy the project URL shown with the API credentials.

It looks like this:

```text
https://<project-ref>.supabase.co
```

Put that exact value into both:

```dotenv
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_URL="https://<project-ref>.supabase.co"
```

`SUPABASE_URL` is the server-side name. The current Function code falls back to `VITE_SUPABASE_URL`, but setting the explicit server-side name makes the deployment easier to understand and less fragile.

### 5.3 Find the browser key

The browser needs a low-privilege Supabase key.

1. In the Supabase Dashboard, open **Project Settings → API Keys**.
2. If the project has the newer key interface, copy the **Publishable key** (`sb_publishable_...`).
3. If you are using the legacy interface, open **Legacy API Keys** and copy the **anon** key.
4. Put that value in:

```dotenv
VITE_SUPABASE_ANON_KEY="<publishable-or-anon-key>"
```

The variable is still named `VITE_SUPABASE_ANON_KEY` because that is what `src/lib/supabase.ts` reads. A newer Supabase publishable key is acceptable in that variable; do not use a secret key there.

### 5.4 Find the server-side Supabase key

The Face ID Functions and the Gemini team-import Function use an elevated Supabase client. They need a server-side key because they read and write enrollment and imported scouting rows outside the browser flow.

1. Open **Project Settings → API Keys**.
2. For a new Supabase project, look for the **Secret keys** section and create/copy a server-only secret key if that is supported by the version of `@supabase/supabase-js` in your deployment.
3. If you need the legacy compatibility path, open **Legacy API Keys** and copy the `service_role` key.
4. Store the value in:

```dotenv
SUPABASE_SERVICE_ROLE_KEY="<server-only-elevated-key>"
```

The environment variable keeps the historical `SERVICE_ROLE` name because the code reads `process.env.SUPABASE_SERVICE_ROLE_KEY`. Whether the value is a newer Supabase secret key or the legacy `service_role` key, treat it as a full-database credential.

Never put this value in a `VITE_` variable, browser code, a public GitHub repository, a screenshot, or a client-side request. A server key can bypass Row Level Security.

Supabase's official API-key explanation is available at [Understanding API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## 6. Apply the Supabase database schema

The repository's [schema.sql](./schema.sql) is the database setup file. It creates the tables, indexes, triggers, Row Level Security policies, storage buckets, and seeded administrator record required by the app.

### 6.1 Run the schema in the SQL Editor

1. Open the Supabase project.
2. Select **SQL Editor** in the left sidebar.
3. Click **New query**.
4. Open this repository's `schema.sql` in your editor.
5. Copy the entire file, from the first comment through the final statement.
6. Paste it into the Supabase SQL Editor.
7. Click **Run**.
8. Wait for the query to finish and review the result panel for errors.

Run the entire file as one migration. Do not paste only the first few table definitions, because the later sections create the policies and storage permissions that the frontend expects.

Supabase also documents this workflow in its [React quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs), where SQL is run from the dashboard's SQL Editor.

### 6.2 What `schema.sql` creates

The current schema creates or updates these application tables:

- `pit_scouts` — pit scouting records;
- `match_scouts` — match scouting records, including JSON data and autonomous-path information;
- `face_id_enrollments` — Face ID embeddings and enrollment metadata;
- `competition_profiles` — saved event profiles and cached team lists;
- `admin_user_profiles` — the seeded admin and scout profiles;
- `admin_user_state` — shared admin state;
- `scout_assignments` — assigned match scouting work;
- `prescouting_team_claims` — ownership of prescouting teams;
- `prescouting_settings` — configured prescouting teams by season;
- `field_map_settings` — the shared field-map record;
- `pit_question_definitions` — editable pit questions; and
- `season_configurations` — global season year, default event, branding, match questions, alliance filters, and scoring rules.

It also creates update timestamps, indexes for common lookup paths, RLS on the tables, and storage permissions.

### 6.3 Important schema side effects

Run `schema.sql` as-is on a new Supabase project. On an existing project, read it carefully and take a backup first. It is written as a migration but includes cleanup behavior that may be destructive to legacy data:

- it removes unscoped or invalid legacy `pit_scouts` rows;
- it removes admin rows whose ID is not `admin`;
- it removes old unscoped pit-photo object paths;
- it drops the legacy `public.team_imports` table; and
- it recreates some policies so the policy state is deterministic.

Do not blindly rerun it against an existing production database if that database contains data from an older, differently structured version of the app. Export a backup from Supabase first and review the cleanup statements with the person responsible for the data.

### 6.4 Storage buckets created by the schema

The schema creates these public buckets:

| Bucket | Used for | Current limit |
| --- | --- | --- |
| `pit-scout-photos` | Pit scouting photos | 8 MiB per object; JPEG, PNG, WebP, HEIC, and HEIF |
| `face-id-snapshots` | Face ID enrollment snapshots | 8 MiB per object; JPEG, PNG, and WebP |
| `field-maps` | Shared field-map images | 8 MiB per object; image MIME types |

The code uploads pit photos under `pit/<event-key>/<team-number>/...` and Face ID images under `faceid/<scope>/<person-name>/...`.

The current schema intentionally makes these buckets public and allows anon/authenticated insert and delete operations so the app can work without Supabase Auth. That is convenient for a closed scouting team, but it is not appropriate for sensitive biometric data on an unrestricted public site. See the security section before production use.

### 6.5 RLS behavior in the current schema

RLS is enabled, but the current schema gives `anon` and `authenticated` broad read/write policies on most application tables. This matches the app's current architecture, where the browser uses the publishable/anon key directly and the app's own profile system is not Supabase Auth.

That means:

- the publishable/anon key is not a secret;
- the database still needs those policies for the current app to function;
- a visitor who knows the project URL and public key may be able to call the exposed tables directly; and
- the app's visible login screen should not be treated as complete database authorization.

For a private team deployment, restrict the site and database access as appropriate. For a public or multi-team deployment, replace the broad policies with event-scoped and role-scoped policies, add a real server-side authentication boundary, and protect storage objects.

### 6.6 Check that the schema ran

In the SQL Editor, you can run read-only checks such as:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'pit_scouts',
    'match_scouts',
    'face_id_enrollments',
    'competition_profiles',
    'admin_user_profiles',
    'scout_assignments',
    'prescouting_team_claims',
    'prescouting_settings',
    'field_map_settings',
    'pit_question_definitions',
    'season_configurations'
  )
order by table_name;

select id, name, public, file_size_limit
from storage.buckets
where id in ('pit-scout-photos', 'face-id-snapshots', 'field-maps')
order by id;

select id, name, role, auth_type
from public.admin_user_profiles
order by id;
```

The first query should return all listed tables. The second should return all three buckets. The third should include the `admin` profile.

## 7. The initial administrator account

The schema seeds one administrator profile:

- Profile: `Admin`
- Database ID: `admin`
- Role: `admin`
- Authentication: shared PIN
- Initial PIN: `4230`

The PIN is represented by a PBKDF2-SHA256 hash in `schema.sql`; the plaintext PIN is not stored in the database. On a fresh install:

1. Open the deployed or local app.
2. Select **Login**.
3. Select **Admin**.
4. Enter `4230`.
5. Click **Sign in as Admin**.

The current UI does not provide an admin-PIN change screen. The PIN is a seeded application credential, not a per-user Supabase Auth password. Before using the app outside a trusted team, plan a proper PIN rotation or replace the shared-PIN design with a server-side authentication flow. At minimum, do not advertise the default PIN to people who should not administer the app.

Scouts can use **Sign Up** to create a scout profile with a name and password. The password is hashed in the browser before it is stored. Admins can also create Face ID profiles through the profile workflow if the Face ID server credentials and storage policies are working.

## 8. Get a The Blue Alliance API key

This app uses TBA for event, team, match, ranking, and match-detail data. The server-side TBA handlers send the key using the `X-TBA-Auth-Key` header, so the key stays out of the browser.

### 8.1 Create the key

1. Open [The Blue Alliance](https://www.thebluealliance.com/).
2. Create an account or sign in.
3. Open your [TBA account dashboard](https://www.thebluealliance.com/account).
4. Find the **Read API Keys** section.
5. Add a new key or generate an access token.
6. Give it a useful description, such as `FRC Scout production Vercel`.
7. Copy the key.

The official TBA API documentation is [Developer APIs](https://www.thebluealliance.com/apidocs). It documents the `X-TBA-Auth-Key` header and the Read API key location.

### 8.2 Add it locally

Put the copied value in `.env.local`:

```dotenv
TBA_API_KEY="paste-your-tba-read-key-here"
```

Do not use `VITE_TBA_API_KEY`. The repository's TBA handlers read `process.env.TBA_API_KEY` on the server.

### 8.3 TBA event keys

The app asks for a TBA event key when an admin creates a competition profile. An event key normally contains the year and the TBA event code, for example:

```text
2026paphi
```

To find an event key, open that event on TBA and inspect the event URL or event details. Enter the key in lowercase when possible; the app normalizes it to lowercase.

The app uses these TBA proxy paths internally:

```text
/api/tba/event/<event-key>
/api/tba/teams/<event-key>
/api/tba/matches/<event-key>
/api/tba/rankings/<event-key>
/api/tba/team_matches_year/<team-number>-<year>
/api/tba/match_detail?matchKey=<match-key>
```

There is a hardcoded team-list fallback for one current event in the source, but it is not a replacement for a TBA API key. Configure TBA normally for any real deployment.

## 9. Statbotics: no API key is needed for this app

The request for a “Statbotics API key” is understandable, but this repository does not require one.

The current Statbotics handlers call public endpoints such as:

```text
https://api.statbotics.io/v3/team/<team-number>
https://api.statbotics.io/v3/team_years?team=<team-number>
https://api.statbotics.io/v3/team_event/<team-number>/<event-key>
https://api.statbotics.io/v3/teams/<event-key>
https://api.statbotics.io/v3/team_matches?...
```

Those requests are made from the Vercel Functions in `api/statbotics/`. They do not send an API key, and the frontend does not read `STATBOTICS_API_KEY`.

Therefore:

- do not add `STATBOTICS_API_KEY` to `.env.local`;
- do not add it to Vercel for the current code;
- do not put a random Statbot or Discord token into this variable; and
- if Statbotics changes its authentication requirements, update the server-side adapters in `api/statbotics/` first, then add a server-only environment variable if the new API requires one.

Use the [Statbotics documentation](https://statbotics.readthedocs.io/en/latest/) for the public FRC data API. This is different from [Statbot's Discord API](https://docs.statbot.net/docs/api/statbot-api/), which does require a key but is an unrelated product.

If Statbotics requests fail, the likely causes are a temporary upstream outage, an unavailable team/event record, a rate limit, or an endpoint response change—not a missing environment variable. The current adapters add response caching headers but do not add authentication.

## 10. Get a Gemini API key

Gemini powers:

- CSV analysis in the Team Lookup flow;
- Gemini-assisted team import; and
- match-note summaries.

The browser calls this repository's `/api/gemini/*` routes. The Vercel Functions create the Google GenAI client with `GEMINI_API_KEY`, so the key stays server-side.

### 10.1 Create the key in Google AI Studio

1. Open [Google AI Studio API Keys](https://aistudio.google.com/apikey).
2. Sign in with your Google account.
3. Choose an existing Google Cloud project or create/select a project when prompted.
4. Click **Create API key**.
5. Copy the generated key immediately into your password manager.
6. If the dashboard offers restrictions, restrict the key to the Gemini API / Generative Language API only.
7. Review quota, billing, and usage settings for the Google Cloud project.

Google's current key instructions are in [Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key).

### 10.2 Add the key locally

```dotenv
GEMINI_API_KEY="paste-your-gemini-key-here"
```

Do not prefix it with `VITE_`. Do not paste it into a React component, commit it to Git, or send it in a browser request.

### 10.3 Gemini model note

The current server routes request the model:

```text
gemini-3-flash-preview
```

That is a model name in application code, not an environment variable. Preview model names can change availability. If Gemini returns a model-not-found or model-not-available error, check Google's current model list and update the model string in:

- `api/gemini/analyze-csv.js`; and
- `api/gemini/summarize-match-notes.js`.

Keep the API key unchanged unless it has been rotated or compromised.

### 10.4 Gemini data and cost considerations

CSV data and scouting notes are sent to Gemini when those features are used. Confirm that your team's data-handling rules permit this. Gemini usage is subject to the selected Google project quota and billing configuration. A key that works in a personal test may stop working after quota is reached or may incur charges if billing is enabled.

## 11. Run the app locally

### 11.1 Basic Vite development server

After filling out `.env.local`, start the app:

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

The repository includes a Vite development middleware for the TBA routes. This allows the event/team/match TBA proxy paths to work during a normal `npm run dev` session when `TBA_API_KEY` is present.

### 11.2 Test all Vercel Functions locally

The complete `api/` directory is intended for Vercel's serverless runtime. The normal Vite server does not automatically emulate every Vercel Function. In particular, `/api/gemini/*`, `/api/faceid/*`, and `/api/statbotics/*` may not behave like production under `npm run dev` alone.

To emulate the Vercel environment locally:

1. Install the Vercel CLI:

   ```bash
   npm install --global vercel
   ```

2. Log in:

   ```bash
   vercel login
   ```

3. Link this directory to the Vercel project:

   ```bash
   vercel link
   ```

4. Run the Vercel development environment from the repository root:

   ```bash
   vercel dev
   ```

Vercel's [vercel dev documentation](https://vercel.com/docs/cli/dev) describes this command as the local environment for testing Functions and Middleware.

If the Vercel project has Development environment variables configured, `vercel dev` can load them. You can also pull them into a local file with:

```bash
vercel env pull
```

Review the generated file and remember that it contains secrets. It is ignored by this repository's `.gitignore`; never commit it.

### 11.3 Local build checks

Before deploying, run:

```bash
npm run lint
npm run build
```

The build should finish successfully and create `dist/`. You can preview the generated frontend with:

```bash
npm run preview
```

`npm run preview` serves the static build, but it does not emulate Vercel Functions. Use `vercel dev` or a Vercel deployment for end-to-end Function testing.

## 12. Deploy the app to Vercel through the dashboard

This is the easiest deployment path.

### 12.1 Import the repository

1. Open [Vercel](https://vercel.com/).
2. Sign in with the Git provider that contains this repository.
3. Click **Add New → Project**.
4. Import the repository.
5. If Vercel asks for a root directory, use the repository root—the folder containing `package.json`.

### 12.2 Set the build configuration

Use these values:

| Vercel setting | Value |
| --- | --- |
| Framework Preset | `Vite` |
| Root Directory | Repository root |
| Install Command | `npm install` or the Vercel default |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js version | A current supported version; Node 20+ is recommended |

There is no separate backend project to deploy. Vercel discovers the files under `api/` and deploys them as Functions alongside the Vite output.

### 12.3 Add all environment variables in Vercel

Before clicking the first deploy, open the project's environment-variable section, or add the values when the import screen provides that option.

In the Vercel dashboard:

1. Open the Vercel project.
2. Go to **Settings**.
3. Open **Environment Variables**.
4. Add each variable below.
5. Select the environments in which it should exist.
6. Save each variable.

For a simple deployment, select **Production**, **Preview**, and **Development** for all variables. If you intentionally use different Supabase projects or API keys per environment, configure the correct value separately for each environment.

Add:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
TBA_API_KEY
GEMINI_API_KEY
```

Use the actual values, not the placeholder values in `.env.example`. Do not include quotation marks unless Vercel's input field specifically requires them; normally you paste the raw value.

The four server-only values are:

- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `TBA_API_KEY`; and
- `GEMINI_API_KEY`.

The two `VITE_` values are build-time browser values. The publishable/anon key is expected to be visible in the frontend bundle; the elevated Supabase key and external API keys are not.

### 12.4 Deploy

Click **Deploy**. Vercel will:

1. install npm dependencies;
2. run `npm run build`;
3. publish `dist/`; and
4. deploy the `api/` files as server-side Functions.

After the deployment completes, open the generated Vercel URL.

### 12.5 Redeploy after changing variables

Environment-variable changes do not retroactively update an already-created deployment. After adding, editing, or rotating a variable, create a new deployment or click **Redeploy** on the deployment page.

This is especially important for `VITE_*` values because they are embedded into the frontend at build time. A deployment built before the variable was added cannot see the new value.

Vercel's current instructions are in [Managing environment variables](https://vercel.com/docs/environment-variables) and [How do I add environment variables to my Vercel project?](https://vercel.com/kb/guide/how-to-add-vercel-environment-variables).

## 13. Deploy from the Vercel CLI (optional)

The dashboard is recommended for the first setup because it makes it easier to select the correct environment for each variable. The CLI is useful for repeat deployments.

```bash
npm install --global vercel
vercel login
vercel link
vercel
```

The first `vercel` command creates a Preview deployment. For production:

```bash
vercel --prod
```

You can inspect configured variable names with:

```bash
vercel env ls
```

Avoid putting secret values directly into shell commands that may be saved in terminal history. Use the Vercel dashboard or the interactive `vercel env add` flow instead.

## 14. First-run application setup

After the first successful deployment:

### 14.1 Sign in as admin

1. Open the deployed URL.
2. Choose **Login**.
3. Choose **Admin**.
4. Enter the initial PIN `4230`.
5. Sign in.

If the admin profile is missing, the schema did not finish or the browser is pointing at a different Supabase project than the one where you ran the schema.

### 14.2 Configure the season

Open the Settings button and configure:

- **Season year** — the FRC season used by prescouting and the app header;
- **Default event key** — the TBA event key automatically used for scouts;
- **Brand name** — the name shown in the navigation bar; and
- **Game name** — the current season/game label.

Click **Save Season Configuration**. The row is stored in `public.season_configurations` under the fixed ID `default`.

The default event key is important for scout accounts. Scouts cannot change the global event; they are routed to the admin-selected event or the configured default event.

### 14.3 Create or select a competition profile

On the Events/Home page, an admin can create a competition profile by entering a TBA event key. The app fetches event information and the team list, then caches that information in Supabase.

After creating a profile:

1. Select it from the Events page.
2. Confirm that the event name and team count are present.
3. Open the Match tab and verify that match data can be loaded.

If profile creation fails, check the TBA key and `TBA_API_KEY` first.

### 14.4 Configure prescouting teams

In Settings, open the **Prescouting Teams** section.

- Enter one team number per line.
- Blank lines are ignored.
- Duplicate team numbers are removed.
- Save the list.

The current schema seeds a 2026 list. Replace it with the teams and season that your team actually wants to prescout. Existing claims and scouting records are retained even if a team is later removed from the active configuration.

### 14.5 Upload the field map

In Settings, use **Field Map** to upload the shared field image.

- The file must be an image.
- The current storage limit is 8 MiB.
- The map is shared across autonomous and shot-map views.
- Only admins should upload or replace it.

If upload fails, confirm that the `field-maps` bucket exists and that the schema's storage policies ran.

### 14.6 Configure questions and scoring

Admins can configure:

- pit question definitions;
- match questions and conditional visibility;
- alliance filters; and
- scoring rules.

Save the configuration after editing it. Validate the resulting questions with a test match before a competition starts, because changing a question's shape can affect how new JSON answers are stored and how older records are displayed.

### 14.7 Create scout profiles

Scouts can create their own profile from the sign-up screen. Use a name that will be recognizable during assignments and a password of at least eight characters.

The admin can:

- review scout profiles;
- assign work;
- ban or unban scouts; and
- see coverage and cleanup tools.

The currently active signed-in profile is stored in browser local storage. The profile records and hashed credentials are stored in Supabase.

## 15. Production smoke-test checklist

Run this checklist after the first deployment and after major environment changes.

### Backend and authentication

- The app loads without `VITE_SUPABASE_URL is not configured`.
- Admin login works with the seeded PIN.
- A scout profile can be created and loaded.
- Signing out clears the active browser profile.

### Supabase data and storage

- A competition profile can be created or selected.
- A pit scouting record can be saved.
- A match scouting record can be saved.
- A pit photo can upload and display.
- The field map can upload and display.
- Prescouting teams can be saved.
- Season configuration can be saved.

### External APIs

- A TBA event/team request succeeds.
- A match list and match detail can load.
- A Statbotics team lookup returns data without any Statbotics environment variable.
- Gemini CSV analysis works if that feature is enabled for your team.
- Gemini match-note summary works when notes exist.
- Face ID enrollment and verification work only after the server-side Supabase credentials and buckets are configured.

### Deployment

- `npm run lint` passes.
- `npm run build` passes.
- Vercel's deployment build log shows the expected environment is being used.
- Vercel Function logs do not report missing keys.
- Production and Preview have the intended environment variables.

## 16. Troubleshooting

### `VITE_SUPABASE_URL is not configured`

Check:

1. The variable is named exactly `VITE_SUPABASE_URL`.
2. `.env.local` is in the repository root, beside `package.json`.
3. The local development server was restarted after editing `.env.local`.
4. The Vercel variable exists in the environment that produced the deployment.
5. The Vercel project was redeployed after the variable was added.

### `VITE_SUPABASE_ANON_KEY is not configured`

Use the Supabase publishable key or legacy anon key. Do not paste the project database password and do not paste the service-role/secret key into this variable.

### Supabase returns 401, 403, or “permission denied”

Check:

- the URL and key belong to the same Supabase project;
- the full `schema.sql` ran successfully;
- the Data API is enabled and the needed public tables are exposed;
- the RLS policies from the schema exist;
- the browser is using the publishable/anon key; and
- the server Functions are using the elevated key only where expected.

You can inspect policies in Supabase under **Authentication/Data → Policies**, depending on the current dashboard layout.

### `TBA_API_KEY is not configured`

This message comes from a TBA Function when `process.env.TBA_API_KEY` is empty.

- Local Vite: confirm `TBA_API_KEY` is in `.env.local`, then restart the server.
- Vercel: add `TBA_API_KEY` under the correct environment and redeploy.
- Confirm the variable is not named `VITE_TBA_API_KEY`.
- Confirm the copied value is a TBA Read API key, not a Supabase or Gemini key.

### TBA returns 401 or 403

The key may be invalid, revoked, copied with extra whitespace, or attached to the wrong request. Create a new Read API key in the TBA account dashboard and replace the Vercel value. The application itself adds the `X-TBA-Auth-Key` header.

### Gemini says the key is missing

Confirm `GEMINI_API_KEY` exists in the Vercel environment running the Function. It must not have a `VITE_` prefix. Redeploy after saving it.

### Gemini returns 403, quota, or model errors

Check:

- the key is active in Google AI Studio;
- the key is restricted to the correct Gemini API;
- the Google Cloud project has available quota/billing configured;
- the request is allowed from server-side Vercel Functions; and
- the preview model `gemini-3-flash-preview` is still available.

If the model has been retired or renamed, update the model string in the two Gemini Function files listed earlier.

### Face ID says Supabase server credentials are not configured

Face ID routes require both:

```dotenv
SUPABASE_URL="https://your-project-ref.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-server-only-key"
```

The code will fall back to `VITE_SUPABASE_URL` for the URL, but it still requires `SUPABASE_SERVICE_ROLE_KEY`. Add the value to Vercel and redeploy. Never solve this by making the service key a `VITE_` variable.

### Gemini CSV analysis works but importing teams fails

These are separate server routes. CSV analysis uses `GEMINI_API_KEY`. The import route writes directly to Supabase and requires `SUPABASE_URL`/`VITE_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`. Configure both sets of credentials.

### Storage upload fails

Check:

- the bucket name is exactly `pit-scout-photos`, `face-id-snapshots`, or `field-maps`;
- the schema's storage section ran;
- the file is below 8 MiB;
- the MIME type is allowed by the bucket; and
- the current browser key has the insert policy needed by the app.

For a production security redesign, make buckets private and replace public URLs with signed URLs rather than broadening permissions.

### API routes return 404 locally

`npm run dev` is primarily the Vite server. The repository's custom Vite plugin handles the local TBA proxy, but not every Vercel Function. Use:

```bash
vercel dev
```

when you need to exercise `/api/gemini/*`, `/api/faceid/*`, or `/api/statbotics/*` locally.

### Statbotics returns an error

Do not add a random API key. The current adapter does not read one. Instead, check:

- the team number and event key;
- whether Statbotics has data for that team/event/year;
- the Vercel Function logs;
- upstream availability; and
- rate-limit behavior.

If Statbotics later requires authentication, implement that in the server-side adapter, not in a React component.

### Vercel still behaves as if an old variable is present

Vercel environment variables are applied to new deployments. Save the variable, trigger a new deployment, and confirm you selected Production vs Preview correctly. Existing deployments do not update automatically.

### The site loads, but the database is empty

Confirm that:

- the production `VITE_SUPABASE_URL` points to the project where `schema.sql` was run;
- `VITE_SUPABASE_ANON_KEY` belongs to that same project;
- the SQL Editor query completed without an error; and
- you are not looking at a Preview deployment configured against a different Supabase project.

## 17. Security and production hardening

The app is easy to bootstrap for a trusted team, but the current default backend policies are intentionally broad. Before exposing the app to the public internet, plan the following.

### 17.1 Restrict database policies

The current anon policies allow broad access so that the browser can sync scouting data without a Supabase Auth session. A public client can potentially call the same Data API directly.

Replace those policies with rules that enforce at least:

- event ownership or event membership;
- scout-vs-admin permissions;
- write restrictions for admin-only tables;
- row ownership for scout assignments and profile changes; and
- validation of event keys and team numbers.

Do this with a migration reviewed against the actual app flows. Do not simply remove all anon policies without also changing the browser data-access architecture, because the frontend currently uses the anon/publishable client directly.

### 17.2 Protect Face ID data

Face embeddings and face snapshots are sensitive biometric-related data. The current schema uses public storage buckets and broad table policies for convenience. For a serious production deployment:

- make the Face ID bucket private;
- protect the enrollment table with strict policies;
- serve images through short-lived signed URLs;
- minimize how long raw snapshots are retained;
- restrict enrollment and verification to authorized users;
- document consent and retention rules; and
- rotate the server key if any enrollment data or key is exposed.

### 17.3 Protect server keys

The Supabase server key bypasses RLS and should only exist in Vercel's server-side environment. TBA and Gemini keys should also stay server-side. If any one of them leaks:

1. Revoke or rotate the key at the provider.
2. Replace it in Vercel.
3. Redeploy the project.
4. Check provider usage and Supabase audit logs for unexpected activity.

### 17.4 Review the shared admin PIN

The default `4230` PIN is known from the repository's schema. It is suitable only as a first-run bootstrap credential. The current UI does not rotate it, so a future security improvement should replace the shared PIN with real administrator authentication and server-enforced authorization.

### 17.5 Control API costs and abuse

Gemini calls can consume quota or incur costs. TBA and Statbotics calls may be rate limited. For public deployments, add server-side request authorization, rate limiting, input-size limits, and usage monitoring around the API routes.

## 18. Where the important code lives

Use this map when maintaining the deployment:

| Area | Location |
| --- | --- |
| Browser Supabase client and storage uploads | `src/lib/supabase.ts` |
| TBA browser adapter | `src/lib/tba.ts` |
| TBA server proxy | `api/tba/` |
| Gemini browser adapter | `src/lib/gemini.ts` |
| Gemini server routes | `api/gemini/` |
| Face ID browser adapter | `src/lib/faceid.ts` |
| Face ID server routes | `api/faceid/` |
| Statbotics browser adapter | `src/lib/statbotics.ts` |
| Statbotics server proxy | `api/statbotics/` |
| Supabase schema and policies | `schema.sql` |
| Environment template | `.env.example` |
| Vite build and local TBA middleware | `vite.config.ts` |
| Season configuration | `src/lib/seasonConfiguration.ts` and Settings |
| Prescouting team configuration | `src/prescouting/teamSettingsRepository.ts` and Settings |
| Local browser sync queue | `src/lib/storage.ts` and `src/lib/sync.ts` |
| Package scripts and dependencies | `package.json` |

Keep provider-specific behavior in the provider adapters and server Functions. Do not move TBA, Gemini, Statbotics, or Supabase secret handling into React components.

## 19. Recommended deployment order

For a clean first deployment, use this order:

1. Clone the repository.
2. Create the Supabase project.
3. Copy the Supabase URL and browser key.
4. Create/copy the Supabase server key.
5. Run the complete `schema.sql` in Supabase.
6. Create the TBA Read API key.
7. Create the Gemini API key.
8. Create `.env.local` and fill in all local variables.
9. Run `npm install`.
10. Run `npm run lint` and `npm run build`.
11. Run `npm run dev` for the basic frontend or `vercel dev` for Function testing.
12. Import the repository into Vercel.
13. Add all six required environment variables to Vercel.
14. Select the correct Production, Preview, and Development environments.
15. Deploy.
16. Sign in as Admin with the initial PIN `4230`.
17. Set the season and default event in Settings.
18. Create/select a competition profile.
19. Configure prescouting teams, field map, questions, and scoring.
20. Create scout profiles and run the smoke-test checklist.
21. Rotate or replace the default admin authentication before public use.

## 20. Official references

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase React quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs)
- [The Blue Alliance Developer APIs](https://www.thebluealliance.com/apidocs)
- [The Blue Alliance account dashboard](https://www.thebluealliance.com/account)
- [Statbotics documentation](https://statbotics.readthedocs.io/en/latest/)
- [Google AI Studio API keys](https://aistudio.google.com/apikey)
- [Gemini API key documentation](https://ai.google.dev/gemini-api/docs/api-key)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel local development with `vercel dev`](https://vercel.com/docs/cli/dev)
- [Vercel Functions](https://vercel.com/docs/functions)
