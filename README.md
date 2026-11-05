# Smart Day Planner — NewTech

Independent NewTech Full Stack Graduation Project. **Phase 1: setup and authentication only.**

React + Vite client, Express API, MySQL users and persistent server sessions. All interface text is English. Registration creates an account; sign-in is a separate step. No tasks, calendar, dashboard, AI, check-in, mood, or scheduling features are included.

## Reference and independence

Read-only reference: [saraalhamede/Smart-daily-planner](https://github.com/saraalhamede/Smart-daily-planner), branch `first-verion`, audited [commit d86360d06600b928ca490fcbbec9792003b01ec6](https://github.com/saraalhamede/Smart-daily-planner/commit/d86360d06600b928ca490fcbbec9792003b01ec6). This application was written independently; the reference repository was not cloned or modified. The new Git repository has no remote configured.

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

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and Express; stop with Ctrl+C |
| `npm run db:init` | Create only the new schema and its two tables, once |
| `npm run db:check` | Verify real MySQL connection, table shape and session store readiness |
| `npm test` | Authentication/security tests with an isolated in-memory repository and store; **not proof of MySQL persistence** |
| `npm run test:integration` | Real MySQL test: two users, separate sessions, restore via new connection/store, logout, revoked-cookie rejection; cleans up only generated QA records |
| `npm run build` | Production frontend build |
| `npm start` | Start API; in production also serve built frontend |
| `npm audit` | Check installed dependency advisories |

Tests open temporary loopback HTTP ports. Restricted environments may require permission to connect to localhost. Integration tests require configured `.env`, an initialized database, and development mode. They fail instead of silently skipping when those are unavailable.

## API

All responses are JSON except successful logout (204). Unsafe requests must include `Origin` exactly matching `CLIENT_ORIGIN`, including CLI/API tests. Browser fetch adds it automatically. No cross-origin API access is enabled.

| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ name, email, password }` → 201 and public user; 400 invalid input, 409 duplicate email |
| POST | `/api/auth/login` | `{ email, password }` → 200, public user and session cookie; 401 invalid credentials |
| GET | `/api/auth/me` | Public user for the server session; 401 when unauthenticated |
| POST | `/api/auth/logout` | Destroy server session and expire cookie; 204, or 401 if unauthenticated |

Passwords: 12–128 characters. Email is trimmed and lowercased. `userId` supplied by the client has no authentication role. The reusable authentication middleware loads the current user from MySQL; user deletion revokes access.

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
server/src/middleware/   Reusable server authentication check
server/db/schema.sql     New users and sessions tables only
server/scripts/          Safe one-time schema setup and connection check
server/test/             Isolated API tests and real MySQL integration test
.env.example             Non-secret configuration template
docs/                    Actual Phase 1 verification report
```

Phase 2 should start only after Phase 1's live MySQL acceptance tests pass and the user explicitly authorizes task CRUD.
