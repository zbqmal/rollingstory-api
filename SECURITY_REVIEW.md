# 🔐 RollingStory Authentication Security Review

> Generated: 2026-02-20
> Scope: `zbqmal/rollingstory-api` (backend) · `zbqmal/rollingstory-web` (frontend)
> Reviewer: GitHub Copilot

---

## Table of Contents

1. [Security Assessment](#1-security-assessment)
2. [Correctness Assessment](#2-correctness-assessment)
3. [Maintainability / Code Quality](#3-maintainability--code-quality)
4. [Suggested Improvements](#4-suggested-improvements)
5. [Production-Readiness Verdict](#5-production-readiness-verdict)
6. [Improvement Roadmap (Phase by Phase)](#6-improvement-roadmap-phase-by-phase)

---

## 1. Security Assessment

### 1.1 Password Storage — ✅ Acceptable, improvable

- `bcrypt` is used with **10 rounds** — correct library and approach.
- ⚠️ **Minor concern:** OWASP currently recommends **12+ rounds** for bcrypt (or switching to Argon2id). At 10 rounds, GPU-accelerated cracking is feasible if the database is ever leaked.

**Files affected:**
- `src/auth/auth.service.ts` — `bcrypt.hash(dto.password, 10)`

---

### 1.2 JWT — ⚠️ Multiple Issues

| Issue | Severity | Detail |
|---|---|---|
| **`'default-secret'` fallback** | 🔴 Critical | If `JWT_SECRET` is missing from the environment, the app silently falls back to a known public string. Any attacker can forge valid JWTs for any user. |
| **7-day expiry, no refresh tokens** | 🟠 High | A stolen token is valid for 7 days with no revocation mechanism. |
| **No algorithm pinning** | 🟡 Medium | Neither `auth.module.ts` nor `jwt.strategy.ts` explicitly sets `algorithms: ['HS256']`. A future config or library change could silently switch algorithms. |
| **Minimal JWT payload** | ✅ Good | Only `sub` and `email` are signed — no excess data exposure. |

**Files affected:**
- `src/auth/auth.module.ts` — `secret: config.get<string>('JWT_SECRET') || 'default-secret'`
- `src/auth/jwt.strategy.ts` — `secretOrKey: config.get<string>('JWT_SECRET') || 'default-secret'`

---

### 1.3 Token Storage (Frontend) — 🔴 Critical

- JWTs are stored in **`localStorage`** on the frontend.
- `localStorage` is accessible to **any JavaScript running on the page**, including third-party scripts and XSS payloads.
- A single XSS vulnerability anywhere in the app can exfiltrate the token, giving an attacker a fully valid 7-day session.
- **Industry standard:** Use `HttpOnly` cookies — invisible to JavaScript, immune to XSS token theft.

**Files affected:**
- `lib/auth.ts` — `localStorage.setItem(tokenStorageKey, response.token)`
- `lib/api.ts` — `localStorage.getItem('token')`

---

### 1.4 CORS — ✅ Correctly Configured

- CORS is scoped to exact allowed origins (no wildcard `*`).
- `credentials: true` is set.

**Files affected:**
- `src/main.ts`

---

### 1.5 Input Validation — ✅ Good

- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` prevents mass-assignment attacks and strips unknown fields.

**Files affected:**
- `src/main.ts`

---

### 1.6 Missing Security Headers — 🟠 High

- There is **no `helmet` middleware** in `main.ts`.
- Without it, the API serves responses without: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` (HSTS), `Content-Security-Policy`, `X-XSS-Protection`.

**Files affected:**
- `src/main.ts` — missing `app.use(helmet())`

---

### 1.7 Rate Limiting — 🔴 Missing

- **No rate limiting** on `/auth/login` or `/auth/register`.
- Vulnerable to: brute-force password attacks, account enumeration, registration flooding.

**Fix:** Add `@nestjs/throttler` globally with a stricter limit on auth endpoints.

**Files affected:**
- `src/auth/auth.controller.ts`
- `src/app.module.ts`

---

### 1.8 Account Enumeration via Registration Errors — 🟡 Medium

- Registration returns distinct errors:
  - "Email already exists" → reveals whether an email is registered
  - "Username already exists" → reveals whether a username is registered
- Attackers can enumerate registered emails using the registration endpoint.

**Recommended fix:** Return a single generic message, e.g. "An account with those credentials already exists."

**Files affected:**
- `src/auth/auth.service.ts`

---

### 1.9 Full User Object (including hashed password) on `request.user` — 🟡 Medium

- `JwtStrategy.validate()` returns the full Prisma `User` object including the `password` field.
- While it's stripped from API responses, the hashed password travels through the entire request lifecycle in memory.

**Recommended fix:**
```typescript
const user = await this.prisma.user.findUnique({
  where: { id: payload.sub },
  select: { id: true, email: true, username: true, createdAt: true, updatedAt: true },
});
```

**Files affected:**
- `src/auth/jwt.strategy.ts`

---

### 1.10 No Logout Endpoint on Backend — 🟡 Medium

- No `POST /auth/logout` exists.
- With stateless JWTs and no token denylist, a compromised token cannot be revoked for its full 7-day lifetime.

---

## 2. Correctness Assessment

| Area | Status | Notes |
|---|---|---|
| Login flow | ✅ Correct | Finds user by email OR username, uses `bcrypt.compare`, returns user + token |
| Register flow | ✅ Correct | Checks uniqueness, hashes password, returns user + token |
| Race condition on registration | ⚠️ Bug | Two concurrent requests with the same email can both pass the uniqueness check; the second will fail with a raw Prisma `P2002` error instead of a clean `409 ConflictException` |
| `/auth/me` endpoint | ✅ Correct | Guard protects it; user is fetched fresh from DB |
| Token returned on register | ✅ Acceptable | Good for UX, but note that email is unverified |
| No email verification | 🟡 Absent | Users register with any email and immediately receive a valid token |
| Password in response | ✅ Correct | Password hash is never returned in any API response |

---

## 3. Maintainability / Code Quality

| Area | Status | Notes |
|---|---|---|
| Module structure | ✅ Clean | NestJS module/controller/service/DTO separation is well-followed |
| DTOs | ✅ Good | Explicit `class-validator` annotations on all fields |
| `GetUser` decorator | ✅ Acceptable | ESLint disables for `any` are pragmatic given Passport's untyped `request.user`; a typed request interface would be better |
| Duplicate fallback secret | 🔴 DRY violation | `'default-secret'` fallback exists in both `auth.module.ts` AND `jwt.strategy.ts` — double the risk |
| Frontend singleton auth pattern | 🟡 Fragile | Global singleton with listeners is a reimplementation of what React Context or Zustand provides more robustly |
| `__resetAuthState` exported | 🟡 Code smell | Test-only helper exported from a production module; use Jest module mocking instead |
| Test coverage | ✅ Good | Unit tests cover happy paths and errors; E2E tests cover main flows |

---

## 4. Suggested Improvements

### 🔴 Critical (fix before production)

1. **Remove `'default-secret'` fallback** in both `auth.module.ts` and `jwt.strategy.ts`. Throw at startup if `JWT_SECRET` is missing.
2. **Migrate token storage from `localStorage` to `HttpOnly` cookies** to prevent XSS-based token theft. Requires backend cookie-setting on login/register and a `POST /auth/logout` to clear it.
3. **Add rate limiting** (`@nestjs/throttler`) on `/auth/login` and `/auth/register`.
4. **Add `helmet`** to `main.ts` for security response headers.

### 🟠 High

5. **Handle Prisma `P2002` constraint errors** from concurrent registration and rethrow as `409 ConflictException`.
6. **Shorten JWT lifetime** (e.g., 15 minutes access + 7-day refresh token) if `HttpOnly` cookies are not immediately feasible.

### 🟡 Medium

7. **Increase bcrypt rounds to 12** (or migrate to Argon2id).
8. **Exclude `password` from `request.user`** using Prisma `select` in `JwtStrategy.validate()`.
9. **Pin JWT algorithm explicitly** (`algorithms: ['HS256']` in strategy; `algorithm: 'HS256'` in sign options).
10. **Normalize registration conflict errors** to a single generic message to prevent email enumeration.
11. **Add email verification** before treating a registered user as fully authenticated.

### 🟢 Low / Nice-to-have

12. **Implement refresh tokens** (short-lived access + long-lived refresh) to reduce stolen-token exposure window.
13. **Add a token denylist** (Redis-backed) for immediate revocation on logout or compromise.
14. **Replace frontend singleton auth** with React Context + Zustand for better SSR compatibility and testability.
15. **Remove `__resetAuthState`** from production exports; use Jest module mocking instead.

---

## 5. Production-Readiness Verdict

### ❌ NOT safe for real users in current state

| Security Gate | Status |
|---|---|
| Passwords properly hashed | ✅ Acceptable |
| JWT secret hardened | ❌ `'default-secret'` fallback is critical |
| Token storage secure | ❌ `localStorage` exposes tokens to XSS |
| Brute-force protection | ❌ No rate limiting on auth endpoints |
| Security headers | ❌ No `helmet` |
| Input validation | ✅ |
| SQL injection prevention | ✅ Prisma parameterized queries |
| CORS configured | ✅ |
| Password excluded from responses | ✅ |
| Error messages non-leaking | ⚠️ Registration leaks email/username existence |

**Minimum required before going to production:**
1. Fix `JWT_SECRET` fallback
2. Move token storage to `HttpOnly` cookies
3. Add rate limiting to auth endpoints
4. Add `helmet`

---

## 6. Improvement Roadmap (Phase by Phase)

> Each phase is scoped, reviewable, and independently deployable. Complete them in order — earlier phases unblock later ones.

---

### Phase 1 — Critical Hardening (Backend) 🔴
> **Goal:** Fix the two most dangerous vulnerabilities. No excuses to delay these.
> **Repos:** `rollingstory-api`
> **Estimated effort:** ~2–3 hours

#### Tasks
- [ ] **1.1** Remove `'default-secret'` JWT fallback in `auth.module.ts` — throw `Error` at startup if `JWT_SECRET` is not set
- [ ] **1.2** Remove `'default-secret'` JWT fallback in `jwt.strategy.ts` — same guard
- [ ] **1.3** Install and configure `@nestjs/throttler`:
  - Global default: 10 requests / 60 seconds
  - Auth endpoints (`/auth/login`, `/auth/register`): 5 requests / 60 seconds
- [ ] **1.4** Install and add `helmet` to `main.ts` (`app.use(helmet())`)
- [ ] **1.5** Update unit and e2e tests to assert throttler and missing-secret behavior

#### Files to change
```
src/auth/auth.module.ts
src/auth/jwt.strategy.ts
src/auth/auth.controller.ts
src/app.module.ts
src/main.ts
package.json (add @nestjs/throttler, helmet, @types/helmet)
```

---

### Phase 2 — Cookie-Based Token Storage 🔴
> **Goal:** Eliminate localStorage token storage and replace with `HttpOnly` cookies.
> **Repos:** `rollingstory-api` + `rollingstory-web`
> **Estimated effort:** ~1 day
> **Prerequisite:** Phase 1

#### Tasks — Backend (`rollingstory-api`)
- [ ] **2.1** On `POST /auth/login` and `POST /auth/register`: set the JWT as an `HttpOnly; Secure; SameSite=Strict` cookie instead of (or in addition to) returning it in the response body
- [ ] **2.2** Add `POST /auth/logout` endpoint: clears the auth cookie
- [ ] **2.3** Update `JwtStrategy` to extract the token from the cookie (`ExtractJwt.fromExtractors([cookieExtractor])`) in addition to (or instead of) the `Authorization` header
- [ ] **2.4** Verify `credentials: true` in CORS config remains set (it already is ✅)
- [ ] **2.5** Update e2e tests to use cookie-based auth flow

#### Tasks — Frontend (`rollingstory-web`)
- [ ] **2.6** Remove all `localStorage.getItem('token')` / `localStorage.setItem('token', ...)` / `localStorage.removeItem('token')` calls from `lib/api.ts` and `lib/auth.ts`
- [ ] **2.7** Add `credentials: 'include'` to all `fetch` calls in `lib/api.ts` so cookies are sent automatically
- [ ] **2.8** Remove `Authorization: Bearer ...` header construction from `apiRequest()` (cookie replaces it)
- [ ] **2.9** Update `lib/auth.ts` `initialize()` to no longer check `localStorage` for a token — instead, just call `GET /auth/me` (cookie is sent automatically); if it fails, user is unauthenticated
- [ ] **2.10** Update all frontend tests in `lib/__tests__/` to remove localStorage assertions

#### Files to change
```
# API
src/auth/auth.controller.ts
src/auth/auth.service.ts
src/auth/jwt.strategy.ts
src/main.ts (cookie-parser middleware)
package.json (add cookie-parser, @types/cookie-parser)

# Web
lib/api.ts
lib/auth.ts
lib/__tests__/auth.test.ts
lib/__tests__/api.test.ts
```

---

### Phase 3 — JWT Hardening & Refresh Tokens 🟠
> **Goal:** Shorten access token lifetime and add refresh token rotation.
> **Repos:** `rollingstory-api` + `rollingstory-web`
> **Estimated effort:** ~1 day
> **Prerequisite:** Phase 2

#### Tasks — Backend
- [ ] **3.1** Shorten access token expiry from `7d` to `15m`
- [ ] **3.2** Add `REFRESH_TOKEN_SECRET` environment variable
- [ ] **3.3** On login/register: issue a second, long-lived (7-day) refresh token as a separate `HttpOnly` cookie (`refresh_token`)
- [ ] **3.4** Add `POST /auth/refresh` endpoint: validates the refresh token cookie, issues a new access token (and optionally rotates the refresh token)
- [ ] **3.5** Update `POST /auth/logout` to clear both the access and refresh token cookies
- [ ] **3.6** Add unit and e2e tests for the refresh flow

#### Tasks — Frontend
- [ ] **3.7** Add automatic token refresh logic: intercept `401` responses in `apiRequest()`, call `POST /auth/refresh`, and retry the original request once
- [ ] **3.8** On refresh failure (e.g., expired refresh token), call `auth.logout()` and redirect to `/login`

#### Files to change
```
# API
src/auth/auth.module.ts
src/auth/auth.service.ts
src/auth/auth.controller.ts
src/auth/dto/ (add RefreshTokenDto if needed)

# Web
lib/api.ts
lib/auth.ts
```

---

### Phase 4 — Security Hardening (Medium Priority) 🟡
> **Goal:** Fix medium-severity issues: bcrypt strength, password in request context, algorithm pinning, enumeration.
> **Repos:** `rollingstory-api`
> **Estimated effort:** ~2–3 hours
> **Prerequisite:** Phase 1

#### Tasks
- [ ] **4.1** Increase bcrypt cost factor from `10` to `12` in `auth.service.ts`
- [ ] **4.2** In `JwtStrategy.validate()`, use Prisma `select` to exclude `password` from `request.user`
- [ ] **4.3** Pin JWT signing algorithm: add `algorithm: 'HS256'` to `signOptions` in `auth.module.ts`
- [ ] **4.4** Pin JWT verification algorithm: add `algorithms: ['HS256']` to `PassportStrategy` super config in `jwt.strategy.ts`
- [ ] **4.5** Normalize registration conflict errors to a single generic message (prevents email enumeration)
- [ ] **4.6** Handle Prisma `P2002` unique constraint errors in `auth.service.ts` `register()` and rethrow as `409 ConflictException` (fixes race condition bug)
- [ ] **4.7** Update unit tests to reflect new error messages and behavior

#### Files to change
```
src/auth/auth.service.ts
src/auth/jwt.strategy.ts
src/auth/auth.module.ts
src/auth/auth.service.spec.ts
```

---

### Phase 5 — Email Verification ✅
> **Goal:** Prevent registration with unowned email addresses.
> **Repos:** `rollingstory-api`
> **Estimated effort:** ~half day to 1 day
> **Prerequisite:** Phase 1, external email provider (e.g., SendGrid, Resend, AWS SES)

#### Tasks
- [x] **5.1** Add `emailVerified`, `emailVerifyToken`, `emailVerifyExpiry`, `resetPasswordToken`, `resetPasswordExpiry` fields to the `User` Prisma model and create a migration
- [x] **5.2** On register: generate a secure random token, store it on the user, send a verification email
- [x] **5.3** Add `POST /auth/verify-email` endpoint: validates token, sets `emailVerified = true`, clears the token
- [x] **5.4** Soft gate: unverified users can still log in (flag is available for future enforcement)
- [x] **5.5** Add `POST /auth/forgot-password` endpoint: generates reset token, sends email (no email enumeration)
- [x] **5.6** Add `POST /auth/reset-password` endpoint: validates token, enforces password policy, invalidates all refresh tokens
- [x] **5.7** Create `EmailModule` / `EmailService` using `nodemailer`; dev-friendly fallback when `SMTP_HOST` is not set
- [x] **5.8** Add unit tests covering `verifyEmail`, `forgotPassword`, `resetPassword`

#### Files to change
```
prisma/schema.prisma
prisma/migrations/ (new migration)
src/auth/auth.service.ts
src/auth/auth.controller.ts
src/auth/dto/ (add VerifyEmailDto)
src/mail/ (new module — email sending)
```

---

### Phase 6 — Frontend Auth Architecture Cleanup 🟢
> **Goal:** Replace the fragile singleton auth pattern with a robust, SSR-compatible solution.
> **Repos:** `rollingstory-web`
> **Estimated effort:** ~half day
> **Prerequisite:** Phase 2 (cookie auth must be in place first)

#### Tasks
- [ ] **6.1** Install Zustand (`yarn add zustand`) for lightweight client-side state
- [ ] **6.2** Replace `lib/auth.ts` singleton + subscriber pattern with a Zustand store
- [ ] **6.3** Update `lib/use-auth.ts` to consume the Zustand store directly
- [ ] **6.4** Remove `__resetAuthState()` from `lib/auth.ts` — use Jest `jest.mock()` instead in tests
- [ ] **6.5** Update all frontend tests to mock via Jest module system, not `__resetAuthState()`
- [ ] **6.6** Verify SSR behavior: initial server render should treat user as unauthenticated (no cookie access server-side without explicit SSR cookie parsing)

#### Files to change
```
lib/auth.ts (replace or rewrite)
lib/use-auth.ts
lib/__tests__/auth.test.ts
lib/__tests__/use-auth.test.ts
package.json (add zustand)
```

---

### Phase 7 — Token Denylist / Revocation (Optional but Recommended) 🟢
> **Goal:** Enable immediate token revocation on logout or account compromise.
> **Repos:** `rollingstory-api`
> **Estimated effort:** ~half day
> **Prerequisite:** Phase 3 (refresh tokens), Redis instance available

#### Tasks
- [ ] **7.1** Add Redis to the stack (`ioredis` or `@nestjs/cache-manager` with Redis adapter)
- [ ] **7.2** On `POST /auth/logout`: add the current access token's `jti` (JWT ID claim) to a Redis denylist with TTL equal to the token's remaining lifetime
- [ ] **7.3** In `JwtStrategy.validate()`: check if the token's `jti` is in the denylist; if so, throw `UnauthorizedException`
- [ ] **7.4** Add `jti` (unique ID) to JWT payload on signing in `auth.service.ts`

#### Files to change
```
src/auth/auth.service.ts
src/auth/jwt.strategy.ts
src/auth/auth.controller.ts
src/redis/ (new module)
package.json (add ioredis or cache-manager-redis-store)
```

---

## Summary Table

| Phase | Scope | Priority | Effort | Prerequisite |
|---|---|---|---|---|
| Phase 1: Critical Hardening | API | 🔴 Critical | ~2–3h | None |
| Phase 2: Cookie-Based Tokens | API + Web | 🔴 Critical | ~1 day | Phase 1 |
| Phase 3: JWT Refresh Tokens | API + Web | 🟠 High | ~1 day | Phase 2 |
| Phase 4: Security Hardening | API | 🟡 Medium | ~2–3h | Phase 1 |
| Phase 5: Email Verification | API | ✅ Complete | ~1 day | Phase 1 |
| Phase 6: Frontend Cleanup | Web | 🟢 Low | ~half day | Phase 2 |
| Phase 7: Token Denylist | API | 🟢 Optional | ~half day | Phase 3 |

---

*This document was generated from a Copilot security review session on 2026-02-20. Re-review after each phase is completed.*