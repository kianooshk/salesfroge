# Salesfroge

Salesfroge is a single-company CRM. The interface follows the Lightning Experience layout (global header, app launcher, nav tabs, list views, record pages, path, related lists, activity timeline, and a kanban pipeline) and is branded as Salesfroge. It is not affiliated with Salesforce, and it does not use the Salesforce name as a product name, the Salesforce logo, or other Salesforce trademarks.

## Features

- **Leads** — assign an owner, set status, and convert a lead into an account, a contact, and an optional opportunity.
- **Accounts and contacts** — company records with related people, opportunities, and cases.
- **Opportunities and pipeline** — stage, amount, close date, probability, a stage path, and a drag-and-drop kanban board.
- **Activities** — tasks, calls, meetings, and notes on any record, plus a month calendar.
- **Cases** — status, priority, assignment, and SLA due dates.
- **Reports and dashboards** — group and aggregate records, then chart them (bar, pie, line, funnel, table) on a dashboard.
- **Users, roles, and permissions** — teams, a role hierarchy, object permissions, and record-level sharing to a person or a team.
- **Email** — send from a record, merge fields, templates, and an SMTP/IMAP connection. Without SMTP the message is still logged on the record. Inbound mail is logged when IMAP is configured.
- **Custom objects and fields** — add objects and fields from Setup, with no code change.
- **Search and list views** — global search, filters, and saved shared list views.
- **Files** — upload attachments and preview images, text, and PDFs.
- **Feed** — a company and record feed with @mentions and comments.
- **CSV** — import with column mapping, and export a list view.
- **Calendar sync** — push meetings to Google Calendar or Outlook when the OAuth environment variables are set and a user connects their account.
- **Sign-in** — email and password, plus Google sign-in when Google OAuth is configured.

Out of scope: products and quotes, workflow automation, campaigns, audit trail, forecasting, a public API or webhooks, an AI assistant, and multi-tenancy.

## Run with Docker

Requires Docker with Compose v2.

```bash
cp .env.example .env   # optional: fill in Google, Outlook, SMTP, and IMAP
docker compose up --build
```

- App: http://localhost:3000
- API: http://localhost:4000/api/health

The backend waits for Postgres, creates the schema, and loads seed data on first start. Later starts keep the existing database volume.

Sign in with any of these accounts. The password for each is `salesfroge`.

| Email | Role |
| --- | --- |
| avery@salesfroge.local | Administrator, Chief Executive |
| jordan@salesfroge.local | VP of Sales |
| sam@salesfroge.local | Sales rep, West Sales |
| riley@salesfroge.local | Sales rep, East Sales |
| morgan@salesfroge.local | Support agent |

Sam can see Riley's "Piper & Oak" lead because it is shared with the West Sales team. Riley cannot see Sam's other leads. That is the record-sharing demo.

## Local development

Node.js 20+ and PostgreSQL 14+ are required.

```bash
npm install
cp .env.example backend/.env
# edit DATABASE_URL if your local Postgres user differs
npm --workspace backend run db:init
npm run dev:backend    # http://localhost:4000/api
npm run dev:frontend   # http://localhost:3000
```

`db:init` creates the schema and seeds the demo company. Running it again skips the seed if `avery@salesfroge.local` already exists.

Backend tests:

```bash
npm test
```

## Environment

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs session tokens |
| `FRONTEND_URL` | Allowed browser origin and OAuth return URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in. Callback: `/api/auth/google/callback` |
| `GOOGLE_CALENDAR_CALLBACK_URL` | Google Calendar connect callback |
| `OUTLOOK_CLIENT_ID` / `OUTLOOK_CLIENT_SECRET` | Outlook calendar connect. Callback: `/api/calendar/outlook/callback` |
| `SMTP_*` | Outbound mail. If unset, sends are logged on the record only |
| `IMAP_*` | Inbound mail sync from Setup → Email |
| `NEXT_PUBLIC_API_URL` | API base the browser calls. Default `http://localhost:4000/api` |

Google sign-in needs the People scopes (`email`, `profile`). Calendar connect asks for Google Calendar events or Microsoft Graph `Calendars.ReadWrite`. The connect buttons return a clear error until those variables are set.

## Design system license

Layout and styling use the open-source [Lightning Design System](https://github.com/salesforce-ux/design-system) package `@salesforce-ux/design-system` (BSD-3-Clause). The stylesheet, icons, and Salesforce Sans font files are copied unmodified from that package at install time.

- The design system code and CSS are BSD-3-Clause. Copyright Salesforce.
- Icons are distributed with the package under Creative Commons Attribution-NoDerivatives 4.0 (see `assets/icons/License-for-icons.txt` in the package, copied to `frontend/public/slds/icons/` on install). They are used unchanged. Attribution: Salesforce.
- Salesfroge does not modify those assets and does not imply endorsement.

The frog mark in `frontend/public/logo.svg` is original to this project.
