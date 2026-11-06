# Smart Day Planner — NewTech

Independent NewTech Full Stack Graduation Project. **Phase 2: authentication and task management.**

React + Vite client, Express API, MySQL users, persistent server sessions, and user-owned task CRUD. All interface text is English. Registration creates an account; sign-in is a separate step. No calendar, dashboard, AI, check-in, mood, or automatic scheduling features are included.

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
| `npm test` | Isolated authentication/security and task input/date validation tests |
| `npm run test:integration` | Real MySQL authentication, task CRUD, ownership, conflicts, concurrency, and actual backend restart tests; cleans up only generated QA records |
| `npm run build` | Production frontend build |
| `npm start` | Start API; in production also serve built frontend |
| `npm audit` | Check installed dependency advisories |

Tests open temporary loopback HTTP ports. Restricted environments may require permission to connect to localhost. Integration tests require configured `.env`, an initialized database, and development mode. They fail instead of silently skipping when those are unavailable.

The repository has no configured lint command or separate automated React test runner. Frontend verification uses the production build and browser QA; no additional test dependencies were introduced for Phase 2.

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
.env.example             Non-secret configuration template
docs/                    Actual Phase 1 verification report
```

Phase 1 was checkpointed locally as `4d52415` after its baseline tests and secret review passed. Phase 2 implementation is saved in `d5278ac`; the final review on 6 November 2026 passed authentication/task tests, real MySQL integration tests, and the production build. See `docs/phase-2-report.md` for actual verification. Calendar and Dashboard require a separate instruction.
