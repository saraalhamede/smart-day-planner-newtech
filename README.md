# Smart Day Planner — NewTech

Independent NewTech Full Stack Graduation Project. **Phase 4: authentication, task management, Daily Planner, and Monthly Calendar.**

React + Vite client, Express API, MySQL users, persistent server sessions, user-owned task CRUD, a date-based Daily Planner, and a read-only Monthly Calendar. All interface text is English. Registration creates an account; sign-in is a separate step. No Dashboard, notifications, AI, check-in, mood, or automatic scheduling features are included.

## Reference and independence

Read-only reference: [saraalhamede/Smart-daily-planner](https://github.com/saraalhamede/Smart-daily-planner), branch `first-verion`, audited [commit d86360d06600b928ca490fcbbec9792003b01ec6](https://github.com/saraalhamede/Smart-daily-planner/commit/d86360d06600b928ca490fcbbec9792003b01ec6). This application was written independently; the reference repository was not cloned or modified. The local `origin` points to the independent `saraalhamede/smart-day-planner-newtech` repository. Phase 2 work does not modify remotes or push commits.

## Requirements

- Node.js 24+, npm, Git
- Running MySQL 8+ compatible server. This computer has MySQL Community Server 26.7.0.
- A local database account authorized to create **only the new schema**, or a DBA who can perform initialization. Runtime needs SELECT/INSERT/UPDATE/DELETE on this application's tables. Do not reuse a production schema.

MySQL is installed at `C:\Program Files\MySQL\MySQL Server 26.7\bin` on the setup computer and is not on PATH. The application uses mysql2 directly and does not require the CLI on PATH.

## Local setup (PowerShell)

Run commands from this project's root:

```powershell
npm ci
if (-not (Test-Path -LiteralPath .env)) { Copy-Item .env.example .env }
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Edit the ignored `.env` locally: configure `DB_USER`, `DB_PASSWORD`, and a random `SESSION_SECRET` of at least 32 characters. Quote environment values containing `#` or spaces. Keep `DB_NAME=smart_day_planner_newtech`. Never put real values into `.env.example`, commit `.env`, or paste secrets into logs/chat. The setup agent already generated a local session secret if `.env` is present.

For first-time local initialization, use an existing MySQL account with permission to create the new schema (commonly `root`) and that account's MySQL password. The template does not create a database account. Use a schema-restricted application account before deployment.

```powershell
npm run db:init
npm run db:check
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). API: `http://127.0.0.1:3001`. Use the exact `127.0.0.1` address, matching `CLIENT_ORIGIN`. Vite proxies `/api` to Express, preserving same-origin cookies. No credentials belong in client variables.

`db:init` is one-time only: it uses plain `CREATE DATABASE`, deliberately failing if the database already exists. It never drops/resets existing databases. It creates `users` and `sessions` from `server/db/schema.sql`. If initialization fails midway, inspect the newly created schema manually before recovery; do not reset any other database. After initialization, use a dedicated account restricted to `smart_day_planner_newtech` for runtime. No account or grants are created automatically.

Fresh initialization also creates `tasks` from `server/db/migrations/002-tasks.sql`. **If Phase 1 is already initialized**, run the following once instead of `db:init`:

```powershell
npm run db:migrate
npm run db:check
```

`db:migrate` adds only the tasks table, indexes and constraints, preserving users and sessions. It deliberately fails if `tasks` already exists; do not re-run it on an initialized Phase 2 database. Runtime startup verifies all three tables, so an unmigrated installation stops with a schema error.

If Vite already runs for this project on port 5173, reuse it and run `npm start` for Express instead of starting a second Vite process. The default date in the interface is the browser's local date; clear the date using **Show all** to view every date.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and Express; stop with Ctrl+C |
| `npm run db:init` | Create only the new schema and its three tables, once |
| `npm run db:migrate` | Add tasks to an existing Phase 1 schema, once; no reset |
| `npm run db:check` | Verify real MySQL connection, table shape and session store readiness |
| `npm test` | Server regression plus client daily/monthly date, view-model, keyboard-navigation and URL-state tests |
| `npm run test:integration` | Real MySQL authentication, task CRUD, ownership, conflicts, concurrency, and actual backend restart tests; cleans up only generated QA records |
| `npm run build` | Production frontend build |
| `npm start` | Start API; in production also serve built frontend |
| `npm audit` | Check installed dependency advisories |

Tests open temporary loopback HTTP ports. Restricted environments may require permission to connect to localhost. Integration tests require configured `.env`, an initialized database, and development mode. They fail instead of silently skipping when those are unavailable.

The repository has no configured lint command or React component test runner. Client model tests use Node's built-in test runner (`npm run test -w client`); frontend verification also uses the production build and browser QA. No additional dependencies were introduced for Phases 2, 3 or 4.

## API

All responses are JSON except successful logout (204). Unsafe requests must include `Origin` exactly matching `CLIENT_ORIGIN`, including CLI/API tests. Browser fetch adds it automatically. No cross-origin API access is enabled.

| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ name, email, password }` → 201 and public user; 400 invalid input, 409 duplicate email |
| POST | `/api/auth/login` | `{ email, password }` → 200, public user and session cookie; 401 invalid credentials |
| GET | `/api/auth/me` | Public user for the server session; 401 when unauthenticated |
| POST | `/api/auth/logout` | Destroy server session and expire cookie; 204, or 401 if unauthenticated |

Passwords: 12–128 characters. Email is trimmed and lowercased. `userId` supplied by the client has no authentication role. The reusable authentication middleware loads the current user from MySQL; user deletion revokes access.

## Tasks

All task routes require the existing session. Identity comes exclusively from the server session. `user_id`, IDs, timestamps and unknown fields in the request body are rejected. Another user's task is indistinguishable from a missing task (404).

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/tasks` or `/api/tasks/` | `{ tasks: [...] }`, current user's tasks only |
| GET | `/api/tasks/:id` | `{ task: {...} }`, or 404 |
| POST | `/api/tasks` | 201, `{ task: {...} }`, and Location header |
| PATCH | `/api/tasks/:id` | Partial update; 200, `{ task: {...} }` |
| DELETE | `/api/tasks/:id` | 204 after deletion, or 404 |

Optional list filters: `?date=2026-11-05&status=waiting&priority=medium`. Filters combine with AND; omitted filters match all values. Invalid filters return 400. Results sort by date, timed tasks first, start time, then ID. The list is intentionally unpaginated for this small graduation-project MVP.

Example task body:

```json
{
  "title": "Review project notes",
  "description": "Prepare a short checklist.",
  "task_date": "2026-11-05",
  "start_time": "09:00",
  "end_time": "10:00",
  "priority": "medium",
  "status": "waiting"
}
```

- Title: trimmed, 1–180 Unicode characters. Description: optional text, maximum 2,000 characters, default empty string. Existing 8 KB JSON limit remains in force.
- Date: required real `YYYY-MM-DD`, years 1000–9999 (MySQL DATE range), with leap-year validation. API reads DATE/TIME as strings; task dates never go through JavaScript Date or UTC conversion. Timestamp metadata is returned as database-session time text.
- Priority: `low`, `medium` (default), `high`. Status: `waiting` (default), `in_progress`, `completed`. All status changes are manual. Completed tasks stay stored and still reserve their time interval.
- Untimed: omit both times on creation or send both as null. Timed: both times required in 24-hour `HH:mm`, with start earlier than end. Send both as null to remove timing on PATCH; an invalid partial pair returns 400. No cross-midnight intervals.
- Overlap means `existing.start < new.end AND existing.end > new.start` for the same user/date, regardless of status. Adjacent intervals are allowed. Conflict returns 409 and preserves the original task.
- At most one in-progress task per user/date. This is checked on create/edit/date changes and backed by a unique index on `(user_id, in_progress_date)`, where the internal generated date is null for other statuses. The internal column is not exposed in API responses.
- Create, edit and delete acquire a locking read on the owning user row inside a MySQL transaction; the row is not modified. This serializes same-user mutations before conflict checks and prevents simultaneous requests from bypassing the rules. Separate users can save independently. Lock failures return 503 with a retry message.
- The task-to-user foreign key uses RESTRICT; users are never removed automatically by task operations.

After sign-in, the interface offers add/edit forms, task list, date/status/priority filters, manual status controls, and a keyboard-accessible delete-confirmation dialog. Mutations show pending/success/error states; list requests support cancellation to prevent stale filter results. An expired session returns the user to sign-in.

## Daily Planner

After sign-in, **Daily Planner** opens by default unless a valid `view` is requested in the page URL; **Tasks** keeps the Phase 2 page available. The planner defaults to today's browser-local calendar date. Select a date or use Previous, Next, or Today. The optional `?day=YYYY-MM-DD` page URL preserves a valid selected date across refresh and navigation. Invalid URL dates fall back to today. Date navigation uses calendar arithmetic, including month/year and leap-century boundaries, without UTC or DST conversions.

The planner reuses `GET /api/tasks?date=YYYY-MM-DD` and shows only that date's tasks in Waiting, In Progress, and Completed sections. **Start task** and **Complete** call the existing `PATCH /api/tasks/:id` with only the requested status. The server remains responsible for authentication, ownership, and the one-in-progress-per-day rule; a second active task returns the existing 409 error. Completed records stay in MySQL.

Daily Timeline is a second, read-only view of the same task objects: timed tasks sort by start time and show their original start/end/title/status; untimed tasks appear separately. Rendering never writes to the API, creates records, assigns times, or changes dates. Status sections and Timeline intentionally repeat a task visually without duplicating its database record.

Edit, delete confirmation, and optional Add task reuse the existing Phase 2 form/list/dialog and endpoints. Finish or cancel an open task form before changing the selected day. Requests for an old date are cancelled when the date changes, and the previous day's tasks are hidden while the next day loads. The interface includes empty, loading, retry, action-error, and success states.

Phase 3 adds **no API endpoint, schema migration, table, or dependency**, and leaves existing backend authentication and task validation rules unchanged.

## Monthly Calendar

The **Calendar** navigation button opens a read-only monthly view. Without an explicit selected date, it starts in the current browser-local month. A date already selected in Daily Planner or the `day` URL parameter takes precedence, so both views stay on the same date. The shared state now lives in the application shell; the existing Daily Planner date controls and API behavior are preserved.

- Weekdays run **Monday–Sunday**. Gregorian arithmetic builds only real dates, with blank cells around the month. Previous/Next handle December/January and leap years within the existing 1000–9999 date range. A month input allows direct navigation; changing the month selects its first day. **This month** selects today's local date.
- The existing authenticated `GET /api/tasks` loads only the session owner's task list. Because the API supports exact-date filters rather than a month range, Calendar filters the list by `task_date` on the client, as intended for this small MVP. There is no new endpoint or table.
- Dates with tasks show a count across all statuses. Clicking a date selects it and updates its read-only summary; **Open Daily Planner** opens that same date for task management. Calendar contains no task create/edit/delete/status controls.
- `?view=calendar&day=YYYY-MM-DD` restores the selected view and date after refresh or sign-in. `view=planner` and `view=tasks` restore the existing pages. Invalid view names fall back to Daily Planner. No routing library is used.
- The selected date is the grid's Tab entry point. Arrow keys move by day/week, Home/End select the first/last day of the month, and Enter/Space use native button activation. Focus follows keyboard navigation across months. The selected day and today have distinct indicators.
- Calendar uses loading, empty-day/month and retry states. **Refresh Calendar** reloads data; returning from Daily Planner also fetches current records. Display never changes dates, times, status, priority, or database records. There is no realtime refresh or scheduling.
- Calendar is loaded on demand with React.lazy/Suspense, keeping it out of the initial page bundle without adding dependencies.

## Security and deployment

- Password hashing: Node.js crypto scrypt, random 16-byte salts, N=32768/r=8/p=1, 64-byte key; constant-time comparison. Password hashes never appear in API responses.
- Server-side MySQL session store. Cookies are HttpOnly, SameSite=Lax, path `/`, expire after eight hours. Secure is enabled in production. IDs rotate on successful login. Logout deletes the stored session.
- Parameterized queries, small JSON limit, server validation, security headers, exact-origin write checks, no-store API responses, and 30 authentication attempts per IP per 15 minutes.
- `express-mysql-session` 3.0.3 pins an older mysql2. Root npm overrides select patched mysql2 3.24.6+ within the same major version; verify compatibility with the integration test after upgrades. See [upstream store documentation](https://github.com/chill117/express-mysql-session).
- Production requires `NODE_ENV=production`, HTTPS `CLIENT_ORIGIN`, TLS termination, and `npm run build`. Set `TRUST_PROXY=true` only behind one trusted reverse proxy that replaces forwarded headers; never expose the backend directly in that configuration. Session cookies will not be issued over plain HTTP in production.
- Use a persistent, randomly generated secret across restarts, a schema-restricted DB account, and HTTPS. The rate limiter is process-local; shared limiting is needed if deploying multiple API processes.
- No email verification or password reset is included in this phase.

## Layout

```text
client/                  React authentication interface and Vite proxy
server/src/app.js        HTTP security and authentication routes
server/src/config.js     Validated environment settings and schema guard
server/src/database.js   mysql2 pool and MySQL session store
server/src/users.js      Parameterized user queries
server/src/passwords.js  scrypt hashing and verification
server/src/tasks/        Task routes, input validation and transactional queries
server/src/middleware/   Reusable server authentication check
server/db/schema.sql     Users and sessions base schema
server/db/migrations/    Additive tasks schema for fresh/existing installations
server/scripts/          One-time setup/migration and connection check
server/test/             Authentication, task validation and real MySQL acceptance tests
client/src/tasks/        Task form, list, delete dialog and page components
client/src/planner/      Daily page, date navigation, status sections, timeline and view model
client/src/calendar/     Monthly grid, read-only day summary, data hook and calendar model
client/src/navigation.js Shared view/date URL state without a routing dependency
client/test/             Daily/monthly dates, read-only data, keyboard and navigation tests
.env.example             Non-secret configuration template
docs/                    Actual Phase 1 verification report
```

Phase 1 was checkpointed locally as `4d52415` after its baseline tests and secret review passed. Phase 2 implementation is saved in `d5278ac`; the final review on 6 November 2026 passed authentication/task tests, real MySQL integration tests, and the production build. See `docs/phase-2-report.md` for actual verification.

Phase 3 started from `e2b7486f3bf62c2616545820ef7353a90e3180cc` and passed final review on 6 November 2026. Its approved local checkpoint is `5b700e4` (`feat: implement daily planner with task status and timeline`). See `docs/phase-3-report.md` for executed checks and results.

Phase 4 started from `5b700e474556e9390f175163b45ae3a42f1324fd` and passed final review on 6 November 2026. Its approved local checkpoint uses `feat: implement monthly calendar with daily planner navigation`; no push is performed. See `docs/phase-4-report.md` for actual results and limitations. Dashboard requires a separate instruction and is not implemented.
