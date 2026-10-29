# AIC MUJ Incubation Portal

The application and program-management portal for **AIC MUJ Incubation Foundation, Manipal University Jaipur**.

- **Public site** (`/`): applicants choose a program — Pre-Incubation, Incubation or Internship — and complete a step-by-step application, then receive a reference number and receipt. Visitors can also send an enquiry.
- **Staff workspace** (`/admin`): review applications, schedule pitches, score startups (single and multi-evaluator sheets, combined report, leaderboard), track cohorts and graduates, keep incubated-startup records with documents, and log enquiries, events, MoUs, AIM, SISFS, coworking and facility records.

| Part | Stack | Hosted on |
| --- | --- | --- |
| Frontend | React 19, React Router 7, Vite 8, Lucide icons | Vercel |
| API | Flask 3, SQLAlchemy Core (SQLite or PostgreSQL) | Vercel (or Render, see below) |

```
backend/
  app.py               entry point (gunicorn app:app)
  gunicorn.conf.py     production server settings (picked up automatically)
  aic/                 the API package
    config.py          all settings come from environment variables
    db.py              schema (works on SQLite and PostgreSQL)
    legacy.py          one-time upgrade of databases created by the old app
    forms.py           field specs + validation for every form
    options.json       choice lists shared with the frontend
    storage.py         file validation; local / database / S3 storage
    mailer.py          Brevo / Resend / SMTP / console email
    auth.py            staff sign-in (signed bearer tokens, rate limited)
    routes/            public, applications, startups, records, files, dashboard
  tests/               pytest suite (SQLite; PostgreSQL via TEST_DATABASE_URL)
src/
  public/              home page, application wizard, receipt
  admin/               staff workspace pages
  components/          shared UI (buttons, fields, dialogs, tables, …)
  lib/                 API client, auth, form schemas, formatting
  styles/              design tokens and styles
```

## Running locally

Requirements: Node 24 (see `.nvmrc`) and Python 3.12+.

**API**

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements-dev.txt
cp .env.example .env            # then set at least ADMIN_PASSWORD (and SECRET_KEY)
python app.py                   # http://127.0.0.1:5000
```

With no `DATABASE_URL`, the API uses `backend/startups.db` (SQLite) and stores uploads in `backend/uploads/`. Set `MAIL_PROVIDER=console` to log emails instead of sending them.

**Frontend**

```bash
npm install
npm run dev                     # http://localhost:5173 — /api is proxied to the Flask server
```

Sign in at `http://localhost:5173/admin/login` with `ADMIN_USERNAME` (default `admin`) and `ADMIN_PASSWORD`.

## Checks

```bash
npm run lint          # ESLint
npm test              # Vitest unit tests (form validation, CSV, helpers)
npm run build         # production build

cd backend
.venv/Scripts/python -m pytest                                              # SQLite
TEST_DATABASE_URL=postgresql://user@localhost:5432/aic_test .venv/Scripts/python -m pytest   # PostgreSQL
```

## Deploying

### Vercel (frontend and API in one project)

[`vercel.json`](vercel.json) deploys the repository as one Vercel project with two [services](https://vercel.com/docs/services) on a single domain:

| Service | Root | Served at | Notes |
| --- | --- | --- | --- |
| `app` | `.` | every path except `/api/*` | Vite build. Unknown paths fall back to `index.html` for client-side routing. |
| `backend` | `backend/` | `/api/*` | Flask (`backend/app.py`). Vercel passes the original path through, so the blueprints' `/api/...` prefixes match as they are. |

Because both share a domain, the frontend calls the API with relative `/api/...` URLs: there is no CORS or `VITE_API_URL` setup. The services never call each other, so no service bindings are declared. `vercel dev` runs both locally.

1. **Project settings** — import the repository with the Root Directory at the repository root and set the Framework Preset to **Services** (Settings → Build and Deployment, or `vercel project update --framework services`).
2. **Database** — Vercel's filesystem is read-only, so SQLite cannot be used: create a free PostgreSQL database on [Neon](https://neon.tech) or [Supabase](https://supabase.com) and set `DATABASE_URL` (the API refuses to start on Vercel without it). Use the provider's pooled connection string, since every function instance opens its own connections.
3. **Files** — with Postgres configured, uploads are stored in the database by default; for larger volumes use an S3-compatible bucket (`STORAGE_BACKEND=s3` and the `S3_*` variables).
4. **Email** — set `MAIL_PROVIDER=brevo` (or `resend`) as described under Render below. On Vercel mail is sent inline (`MAIL_ASYNC` defaults to off) because a function can be frozen as soon as the response is sent.
5. **Environment variables** — at minimum `SECRET_KEY`, `ADMIN_PASSWORD`, `DATABASE_URL` and the email variables, for both Production and Preview. Every variable is described in [`backend/.env.example`](backend/.env.example). Without a fixed `SECRET_KEY` each function instance signs sessions with its own key and staff are signed out at random.

**Limits to plan around.** Vercel Functions cap request and response bodies at **4.5 MB**. An upload whose total size is larger is rejected before it reaches Flask, and so is a download or a *Download all* zip larger than that, while the forms accept up to 20 MB per file (`MAX_FILE_MB` in `src/lib/formSchemas.js`). The login and submission rate limiters are also kept in memory per function instance, so they are weaker than on a single server. If that does not suit the volume of documents you handle, keep the API on Render instead.

### Alternative: API on Render

To keep the API off Vercel, remove the `backend` service and the `/api/` rewrite from `vercel.json`, deploy the frontend as a plain Vite project, and set `VITE_API_URL` to the Render URL. Render's free tier has an **ephemeral disk** (it is wiped on every deploy and restart) and **blocks outbound SMTP**. So for production:

1. **Database** — create a free PostgreSQL database on a host that keeps data, e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com) (Render's own free Postgres is deleted after 30 days). Put its connection string in `DATABASE_URL`.
2. **Files** — with Postgres configured, uploads are stored in the database by default (`STORAGE_BACKEND=database`), so nothing else is needed. For large volumes, use an S3-compatible bucket instead (Cloudflare R2 has a free tier): set `STORAGE_BACKEND=s3` and the `S3_*` variables.
3. **Email** — create a free [Brevo](https://www.brevo.com) account, verify a sender address (an address on a domain you control gives the best deliverability), and set `MAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `MAIL_FROM` and `ADMIN_NOTIFY_EMAIL`. [Resend](https://resend.com) also works (`MAIL_PROVIDER=resend`) if you can verify a domain.
4. **Service settings** — Root directory `backend`, build command `pip install -r requirements.txt`, start command `gunicorn app:app`.
5. **Environment variables** — at minimum `SECRET_KEY`, `ADMIN_PASSWORD`, `DATABASE_URL`, plus the email variables above. Every variable is described in [`backend/.env.example`](backend/.env.example). `CORS_ORIGINS` must include the frontend's URL.

The first start creates all tables automatically. Staff sign-in stays disabled until `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`) is set.

Old links of the form `/?view=form` redirect to the Pre-Incubation application.

## Notes for maintainers

- **Choice lists** (sectors, stages, statuses, evaluation criteria) live in `backend/aic/options.json` and are imported by both the API validators and the React forms. Edit them in one place.
- **Field rules** are declared in `backend/aic/forms.py` and mirrored for instant feedback in `src/lib/formSchemas.js`; the API is always authoritative.
- **Statuses**: Pre-Incubation `Pending → Approved (in program) → Graduated` or `Rejected`; Incubation `Pending → Approved` or `Rejected`; Internship `Applied → Selected (current intern) → Completed` or `Rejected`. Incubated startups at the *Scaling* stage are listed as graduated.
- **Documents issued by AIC** (offer letters, certificates, agreements) are uploaded from the *Issued by AIC* tab of any application or incubated startup. They are stored apart from what the applicant submitted (`files.source = 'aic'`), are left out of “Download all”, and can be emailed to the applicant as an attachment (up to `MAX_EMAIL_ATTACHMENT_MB`, default 10 MB).
- **Email** is sent on submission (applicant + `ADMIN_NOTIFY_EMAIL`), on decisions (staff can untick “Email the applicant”) and when a pitch is scheduled.
- **Cold starts**: an idle API takes a few seconds to wake on Vercel (up to about a minute on Render's free tier). The site warms it up when the home page loads and shows a “Connecting to the server…” notice during slow requests.
- **Existing SQLite databases** from the previous version are upgraded automatically on first start; the original file is copied to `startups.db.pre-upgrade-backup` and old tables are kept as `legacy_*`.
