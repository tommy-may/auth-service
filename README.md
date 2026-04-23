# Auth Service

A stateless, JWT-based authentication microservice built with [Bun](https://bun.com), [Hono](https://hono.dev), and [PostgreSQL](https://www.postgresql.org) via [Drizzle ORM](https://orm.drizzle.team).

Designed to be consumed by other services or a frontend client. It handles user registration, login, token refresh, password reset, and session management — with a focus on security and simplicity.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [How Authentication Works](#how-authentication-works)
  - [Registration](#registration)
  - [Login](#login)
  - [Token Refresh](#token-refresh)
  - [Password Reset](#password-reset)
  - [Logout](#logout)
- [Session Management](#session-management)
- [Security Design](#security-design)
  - [Password Hashing](#password-hashing)
  - [Timing Attack Prevention](#timing-attack-prevention)
  - [Refresh Token Storage](#refresh-token-storage)
  - [JTI Blacklist](#jti-blacklist)
  - [Rate Limiting](#rate-limiting)
- [Database Cleanup](#database-cleanup)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Scripts Reference](#scripts-reference)

---

## Quick Start

Follow these steps to set up the project locally on your machine.

**Prerequisites**

Make sure you have the following installed on your machine:

- [Bun](https://bun.com) — Fast all-in-one JavaScript runtime
- [Docker](https://www.docker.com/products/docker-desktop/) — Local PostgreSQL instance

### Installation

Install the project dependencies using bun:

```sh
bun install
```

### Environment Variables

Copy the file named `.env.example` and rename it `.env.development` in the root of your project and replace the placeholder values with yours.

```sh
cp .env.example .env.development
```

Generate the required secrets:

```sh
bun run dummy-hash:generate
bun run jwt-secret:generate
```

Then fill in your `DB_*` values in `.env.development`.

### Database

```sh
bun run db:dev
```

This starts a PostgreSQL 17 container via Docker Compose using the credentials from `.env.development`.

### Migrations

```sh
bun run db:migrate
```

### Running the Project

```sh
bun run start:dev
```

The server will start with hot-reload on `http://localhost:3000` (or the `PORT` you configured).

> **Note:** `bun run db:dev` builds a custom Docker image the first time it runs. The `sql/pg_cron.sql` init script (which installs the extension and schedules cleanup jobs) is executed automatically on **first volume creation only**. If you already had an existing volume from a previous setup, run the SQL file manually inside the container.

---

## Architecture Overview

The service follows a layered architecture where each layer has a single responsibility:

```
Request
  │
  ▼
┌─────────────────────────────────────────┐
│   Middleware                            │  CORS, Request ID, Rate Limiting, Auth Guard
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│   Router                                │  Route Definitions, Input Validation (Zod)
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│   Services                              │  Business Logic
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│   Repository                            │  Database Queries & Transactions (Drizzle ORM)
└─────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────┐
│   PostgreSQL                            │  Users · Sessions · Blacklist
└─────────────────────────────────────────┘
```

**Router** — Defines the HTTP interface. Validates incoming request payloads with Zod before they reach the service layer. Handles cookies and response headers.

**Services** — Contains all business logic. Orchestrates hashing, token generation, and calls to the repository. Has no knowledge of HTTP.

**Repository** — The only layer that talks to the database. Groups operations into transactions where atomicity is required.

### Local Packages

Shared utilities are extracted into local packages under `packages/`, consumed via the `#pkg/*` import alias:

| Package                       | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `#pkg/http-response`          | Typed `MyResponse` helpers and `HttpError` class |
| `#pkg/rate-limit`             | Custom in-memory rate limiter middleware         |
| `#pkg/config/eslint-config`   | Shared ESLint configuration                      |
| `#pkg/config/prettier-config` | Shared Prettier configuration                    |

### Database Schema

Three tables model the entire domain:

```
users
  id (uuid v7, PK)
  email (unique)
  password (argon2id hash)
  created_at / updated_at

sessions
  id (uuid v7, PK)
  user_id (FK → users, CASCADE DELETE)
  value (SHA-256 hash of the refresh token, unique)
  value_expires_at
  jti (the access token's JTI linked to this session)
  jti_expires_at
  user_agent
  created_at / updated_at

blacklist
  jti (uuid, PK)
  expires_at
```

---

## How Authentication Works

This service uses a **dual-token** strategy: a short-lived **Access Token** (JWT) and a long-lived **Refresh Token** (opaque random string).

| Token         | Lifetime   | Transport                                    | Storage           |
| ------------- | ---------- | -------------------------------------------- | ----------------- |
| Access Token  | 15 minutes | `Authorization: Bearer <token>` header       | Client memory     |
| Refresh Token | 7 days     | `HttpOnly` cookie + `X-Refresh-Token` header | Database (hashed) |

The refresh token is sent both as an `HttpOnly` cookie (for browser clients) and in the `X-Refresh-Token` response header (for non-browser clients such as mobile apps or other services). The server accepts it from either the cookie or the `Authorization-Refresh-Token` request header.

### Registration

```
POST /auth/register
{ "email": "...", "password": "..." }
```

1. The password is hashed with **Argon2id**.
2. The user is inserted into the `users` table.
3. If the email is already taken, a `409 Conflict` is returned. The unique constraint check is done at the database level to avoid race conditions.
4. Returns the created user (without the password).

### Login

```
POST /auth/login
{ "email": "...", "password": "..." }
```

1. The user is looked up by email.
2. The submitted password is verified against the stored hash. If the user does not exist, a dummy hash is verified instead (see [Timing Attack Prevention](#timing-attack-prevention)).
3. On success, a new **access token** and **refresh token** are generated.
4. The refresh token is hashed (SHA-256) and stored in the `sessions` table alongside its linked JTI.
5. If the user already has 5 active sessions, the **oldest one is evicted** automatically.
6. Returns the access token in the body and the refresh token via cookie and header.

### Token Refresh

```
POST /auth/refresh
Cookie: refresh_token=<value>   (or Authorization-Refresh-Token: <value>)
```

1. The submitted refresh token is hashed and looked up in the `sessions` table.
2. Expiry is checked.
3. A **new access token and refresh token pair** is issued.
4. In a single transaction:
   - The old JTI is added to the **blacklist** (so the previous access token immediately becomes invalid).
   - The session row is updated with the new token values.
5. Returns the new token pair.

### Password Reset

```
POST /auth/password-reset
Authorization: Bearer <access_token>
{ "currentPassword": "...", "password": "..." }
```

1. Requires a valid access token (`authGuard`).
2. The current password is verified.
3. In a single atomic transaction:
   - The password is updated.
   - **All existing sessions are invalidated** (their JTIs are blacklisted, then the rows are deleted).
   - A new session is created immediately, so the user stays logged in on the current device.
4. Returns a fresh token pair.

### Logout

```
POST /auth/logout
Cookie: refresh_token=<value>   (or Authorization-Refresh-Token: <value>)
```

1. The refresh token is hashed and used to find the session.
2. The session's JTI is added to the blacklist, then the session row is deleted — in a transaction.
3. The `refresh_token` cookie is cleared.
4. If no token is provided, logout is silent (returns `204` with no error) — this avoids leaking whether a session existed.

---

## Session Management

Active sessions can be inspected and managed via the `/auth/sessions` routes (all require a valid access token).

```
GET    /auth/sessions                     → List all active sessions for the current user
DELETE /auth/sessions/:id                 → Revoke a specific session by ID
DELETE /auth/sessions                     → Revoke all sessions
DELETE /auth/sessions?keep_current=true   → Revoke all sessions except the current one
```

The "revoke all except current" feature is the classic **"logout all other devices"** flow. It works by resolving the current session from the refresh token before deleting the rest.

---

## Security Design

### Password Hashing

Passwords are hashed with **Argon2id** — the algorithm recommended by OWASP for new applications. The parameters used:

```
memory cost:  62,500 KiB (~64 MB)
time cost:    3 iterations
parallelism:  1
```

These values follow the OWASP guidelines for interactive logins and make brute-force attacks expensive. Hashing and verification are handled by Bun's native `Bun.password` API.

### Timing Attack Prevention

A naive login implementation returns faster when the user does not exist (because it skips the hash comparison), leaking whether an email is registered. This service prevents that by **always running a hash comparison**, even when the user is not found:

```ts
// verifyTAP uses env.DUMMY_HASH as a fallback when no hash is provided
const verify = await MyPassword.verifyTAP(password, user?.password);
```

The `DUMMY_HASH` in `.env.development` is a valid pre-computed Argon2id hash. Its format is validated by Zod at startup — the service will refuse to start with a malformed or missing hash.

### Refresh Token Storage

Refresh tokens are **never stored in plaintext**. The value sent to the client is a 64-byte cryptographically random string. Before being saved to the database, it is hashed with SHA-256. This means a database breach does not expose usable tokens.

### JTI Blacklist

Access tokens are stateless JWTs and cannot normally be invalidated before expiry. This service solves that with a **JTI (JWT ID) blacklist**: each access token contains a unique `jti` claim. When a session is invalidated (logout, refresh, password reset), the JTI is inserted into the `blacklist` table. The `authGuard` middleware checks the blacklist on every request.

The blacklist only needs to hold entries for as long as the access token they correspond to could still be valid (15 minutes). The pg_cron cleanup job runs every 30 minutes, ensuring the table never grows beyond roughly two windows of stale entries.

### Rate Limiting

Two rate limiters protect the service from brute-force and abuse, powered by a custom in-memory store with a sliding window:

| Limiter    | Applied to                                          | Limit                                  | Window     |
| ---------- | --------------------------------------------------- | -------------------------------------- | ---------- |
| **Global** | All routes not under `/auth/*`                      | 200 requests                           | 1 minute   |
| **Auth**   | All `/auth/*` routes (including `/auth/sessions/*`) | 10 failed attempts (60 for `/refresh`) | 15 minutes |

The auth limiter uses `skipSuccessfulRequests: true` — only failed attempts (4xx/5xx) consume the budget, so legitimate users are not penalised for normal usage.

The client IP is extracted from standard proxy headers in priority order: `x-real-ip`, `x-forwarded-for`, `cf-connecting-ip`, `fly-client-ip`. Rate limit headers (`RateLimit-*`, `Retry-After`) are exposed to the client on every response.

> **Note:** The built-in `MemoryStore` does not share state across multiple instances. In a horizontally scaled deployment, replace it with a Redis-backed store.

---

## Database Cleanup

Expired data is purged directly by PostgreSQL using **[pg_cron](https://github.com/citusdata/pg_cron)**, a PostgreSQL extension for scheduling jobs inside the database. This removes the need for application-level timers, meaning cleanup continues reliably even when the application is restarted or scaled.

The development database is built from a custom `database.Dockerfile` that installs the `pg_cron` extension on top of the official `postgres:17.5` image. The `sql/pg_cron.sql` init script is executed automatically on first volume creation via `docker-entrypoint-initdb.d`.

Two jobs are scheduled:

| Job name            | Schedule         | Query                                                 |
| ------------------- | ---------------- | ----------------------------------------------------- |
| `blacklist-cleanup` | Every 30 minutes | `DELETE FROM blacklist WHERE expires_at < NOW()`      |
| `sessions-cleanup`  | Daily at 03:00   | `DELETE FROM sessions WHERE value_expires_at < NOW()` |

The blacklist is cleaned every 30 minutes because access tokens expire after 15 minutes — two windows is enough to ensure no valid JTI is ever removed prematurely. Sessions are cleaned daily since they live for 7 days and there is no urgency.

### Production Setup

In production, pg_cron must be enabled manually on your PostgreSQL instance:

```sql
-- Run as superuser
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permission to your application user (replace with your actual username)
GRANT USAGE ON SCHEMA cron TO your_db_user;

-- Schedule the cleanup jobs
SELECT cron.schedule('blacklist-cleanup', '*/30 * * * *',
  $$ DELETE FROM blacklist WHERE expires_at < NOW(); $$);

SELECT cron.schedule('sessions-cleanup', '0 3 * * *',
  $$ DELETE FROM sessions WHERE value_expires_at < NOW(); $$);
```

Managed PostgreSQL services that support pg_cron include **Supabase**, **Neon**, and **AWS RDS** (with `pg_cron` enabled in the parameter group).

---

## API Reference

All routes are prefixed with `/auth`.

### Auth Routes — `/auth`

> The auth limiter applies to all routes in this group (10 failed attempts per 15 minutes, except `/refresh` which allows 60).

| Method | Path                   | Auth          | Description                          |
| ------ | ---------------------- | ------------- | ------------------------------------ |
| `POST` | `/auth/register`       | —             | Create a new user account            |
| `POST` | `/auth/login`          | —             | Authenticate and receive tokens      |
| `POST` | `/auth/refresh`        | Refresh token | Issue a new token pair               |
| `POST` | `/auth/password-reset` | Access token  | Change password and rotate tokens    |
| `POST` | `/auth/logout`         | Refresh token | Invalidate the current session       |
| `GET`  | `/auth/me`             | Access token  | Get the authenticated user's profile |

### Sessions Routes — `/auth/sessions`

> All routes require a valid access token. The auth limiter applies (10 failed attempts per 15 minutes).

| Method   | Path                 | Query               | Description                                |
| -------- | -------------------- | ------------------- | ------------------------------------------ |
| `GET`    | `/auth/sessions`     | —                   | List all active sessions                   |
| `DELETE` | `/auth/sessions/:id` | —                   | Revoke a session by ID                     |
| `DELETE` | `/auth/sessions`     | —                   | Revoke all sessions                        |
| `DELETE` | `/auth/sessions`     | `keep_current=true` | Revoke all sessions except the current one |

### Response Format

All responses follow a consistent envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "message": "...", "code": "SOME_CODE" } }
```

### Error Codes

| Code                      | Status    | Meaning                                             |
| ------------------------- | --------- | --------------------------------------------------- |
| `VALIDATION`              | 400       | Request body/params failed schema validation        |
| `INVALID_CREDENTIALS`     | 401       | Wrong email or password                             |
| `INVALID_TOKEN`           | 401 / 403 | Access token missing, malformed, or blacklisted     |
| `INVALID_REFRESH_TOKEN`   | 401       | Refresh token missing                               |
| `REFRESH_TOKEN_NOT_FOUND` | 403       | Refresh token not found in the database             |
| `REFRESH_TOKEN_EXPIRED`   | 403       | Refresh token has expired                           |
| `EMAIL_TAKEN`             | 409       | Email is already registered                         |
| `SESSION_NOT_FOUND`       | 404       | Session ID not found or does not belong to the user |
| `RATE_LIMIT_EXCEEDED`     | 429       | Too many requests                                   |
| `SERVER_ERROR`            | 500       | Unexpected server error                             |

---

## Environment Variables

| Variable          | Required | Default                 | Description                                                                                          |
| ----------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `NODE_ENV`        | ✅       | —                       | `development` or `production`                                                                        |
| `PORT`            | —        | `3000`                  | Port the server listens on                                                                           |
| `ALLOWED_ORIGINS` | —        | `http://localhost:5173` | Comma-separated list of allowed CORS origins                                                         |
| `DB_USER`         | ✅       | —                       | PostgreSQL username                                                                                  |
| `DB_PASSWORD`     | ✅       | —                       | PostgreSQL password                                                                                  |
| `DB_HOST`         | ✅       | —                       | PostgreSQL host                                                                                      |
| `DB_PORT`         | ✅       | —                       | PostgreSQL port                                                                                      |
| `DB_NAME`         | ✅       | —                       | PostgreSQL database name                                                                             |
| `DUMMY_HASH`      | ✅       | —                       | Pre-computed Argon2id hash for timing attack prevention. Generate with `bun run dummy-hash:generate` |
| `JWT_SECRET`      | ✅       | —                       | Base64url-encoded secret for signing JWTs. Generate with `bun run jwt-secret:generate`               |

The service validates all variables at startup via Zod and exits with a descriptive error if any required value is missing or malformed.

---

## Scripts Reference

| Script                        | Description                                               |
| ----------------------------- | --------------------------------------------------------- |
| `bun run start:dev`           | Start with watch mode (hot-reload)                        |
| `bun run db:dev`              | Start PostgreSQL via Docker Compose                       |
| `bun run db:generate`         | Generate a new Drizzle migration from schema changes      |
| `bun run db:migrate`          | Apply pending migrations                                  |
| `bun run db:studio`           | Open Drizzle Studio (browser-based DB explorer)           |
| `bun run dummy-hash:generate` | Generate an Argon2id hash to use as `DUMMY_HASH`          |
| `bun run jwt-secret:generate` | Generate a random base64url string to use as `JWT_SECRET` |
| `bun run type:check`          | TypeScript type-checking without emitting files           |
| `bun run format`              | Format all files with Prettier                            |
| `bun run lint:fix`            | Run ESLint with auto-fix                                  |
