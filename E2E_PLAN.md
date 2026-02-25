# E2E Test Plan

This document is the source of truth for all end-to-end tests in the `rollingstory-api` project. It tracks what tests exist, what was added in each phase, and what is still planned.

---

## 1. Overview

### Purpose

This document tracks every e2e test case across all test phases, grouped by endpoint and spec file. Use it to understand test coverage at a glance and to plan future additions.

### Test Environment Requirements

- **PostgreSQL** test database (separate from dev/prod)
- **Redis** on index 1 (separate from dev/prod)

### `.env.test` Setup

Create a `.env.test` file in the repository root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/rollingstory_test"
REDIS_URL="redis://localhost:6379/1"
JWT_SECRET="test-secret-minimum-64-characters-long-xxxxxxxxxxxxxxxxxxxxxxxxxx"
RESEND_API_KEY="re_test_placeholder"
EMAIL_FROM="noreply@test.local"
FRONTEND_URL="http://localhost:3000"
```

### How to Run E2E Tests

```bash
# Run all e2e tests
npx dotenv -e .env.test -- yarn test:e2e

# Run a single spec file
npx dotenv -e .env.test -- yarn test:e2e --testPathPattern="auth.e2e-spec"

# Run a single test by name
npx dotenv -e .env.test -- yarn test:e2e --testPathPattern="auth.e2e-spec" -t "test name pattern"
```

---

## 2. Test Helpers (`test/helpers/`)

| File | Exports | Description |
|------|---------|-------------|
| `cookie.helper.ts` | `parseCookieHeaders` | Parses `Set-Cookie` headers into a name→raw-string map |
| | `extractCookieValue` | Extracts the raw value of a named cookie |
| | `extractCookieForRequest` | Returns `name=value` portion ready for `.set('Cookie', ...)` |
| | `isHttpOnly` | Returns `true` if the named cookie has the `HttpOnly` flag |
| | `isSecure` | Returns `true` if the named cookie has the `Secure` flag |
| | `getSameSite` | Returns the `SameSite` attribute value (lowercase) or `null` |
| | `isCookieCleared` | Returns `true` if the cookie value is empty (cookie was cleared) |
| `db.helper.ts` | `cleanDatabase(prisma)` | Deletes all records in FK-safe cascade order: `workCollaborator → page → work → refreshToken → user` |
| `auth.helper.ts` | `registerUser(app, payload)` | Registers a user and returns `AuthResult` |
| | `loginUser(app, emailOrUsername, password)` | Logs in a user and returns `AuthResult` |
| | `TEST_USER` | Default test user: `{ email, username, password }` |
| | `TEST_USER_2` | Second test user: `{ email, username, password }` |

**`AuthResult` shape:**
```typescript
{
  userId: string;
  accessTokenCookie: string;  // "access_token=<jwt>" — ready for .set('Cookie', ...)
  refreshTokenCookie: string; // "refresh_token=<value>" — ready for .set('Cookie', ...)
  allCookies: string;         // both cookies joined for .set('Cookie', ...)
}
```

---

## 3. Auth E2E Test Plan (`test/auth.e2e-spec.ts`)

### `/auth/register (POST)`

| Status | Test |
|--------|------|
| ✅ Exists | should register a new user |
| ✅ Exists | should return 409 if email already exists |
| ✅ Exists | should return 409 if username already exists |
| ✅ Exists | should return 400 if validation fails |
| 🆕 Added in Phase 2 | should set both access_token and refresh_token cookies on register |
| 🆕 Added in Phase 2 | should set HttpOnly flag on both cookies |

### `/auth/login (POST)`

| Status | Test |
|--------|------|
| ✅ Exists | should login with email |
| ✅ Exists | should login with username |
| ✅ Exists | should return 401 if password is wrong |
| ✅ Exists | should return 401 if user does not exist |
| 🆕 Added in Phase 2 | should set both access_token and refresh_token cookies on login |
| 🆕 Added in Phase 2 | should set HttpOnly flag on both cookies on login |

### `/auth/refresh (POST)`

| Status | Test |
|--------|------|
| 🆕 Added in Phase 2 | should return 401 if refresh_token cookie is missing |
| 🆕 Added in Phase 2 | should return 401 if refresh_token is malformed (no dot separator) |
| 🆕 Added in Phase 2 | should return 401 if refresh_token does not match any stored token |
| 🆕 Added in Phase 2 | should refresh tokens and rotate — old refresh token rejected afterward |
| 🆕 Added in Phase 2 | should issue new access_token and refresh_token cookies on successful refresh |

### `/auth/logout (POST)`

| Status | Test |
|--------|------|
| ✅ Exists | should logout and clear cookie |
| 🆕 Added in Phase 2 | should reject access_token on a protected route after logout (JTI denylist) |
| 🆕 Added in Phase 2 | should return success even when called without any cookies |

### `/auth/me (GET)`

| Status | Test |
|--------|------|
| ✅ Exists | should return current user with valid cookie |
| ✅ Exists | should return 401 without token |
| ✅ Exists | should return 401 with invalid token |

### `/auth/verify-email (POST)`

| Status | Test |
|--------|------|
| 🆕 Added in Phase 2 | should return 400 for an invalid/nonexistent token |
| 🆕 Added in Phase 2 | should return 400 for an empty token |
| 🆕 Added in Phase 2 | should verify email successfully with a valid token |

### `/auth/resend-verification (POST)`

| Status | Test |
|--------|------|
| 🆕 Added in Phase 2 | should always return 200 even if email does not exist (enumeration protection) |
| 🆕 Added in Phase 2 | should always return 200 even if user is already verified (enumeration protection) |

### `/auth/forgot-password (POST)`

| Status | Test |
|--------|------|
| 🆕 Added in Phase 2 | should always return 200 even if email does not exist (enumeration protection) |

### `/auth/reset-password (POST)`

| Status | Test |
|--------|------|
| 🆕 Added in Phase 2 | should return 400 for an invalid/nonexistent token |
| 🆕 Added in Phase 2 | should reset password and allow login with new password |
| 🆕 Added in Phase 2 | should reject old password after reset |

### `DELETE /auth/me`

| Status | Test |
|--------|------|
| ⏳ Future Phase | should delete account and return 200 |
| ⏳ Future Phase | should return 401 after account deletion |

### Rate Limiting

| Status | Test |
|--------|------|
| ✅ Exists | should return 429 after exceeding rate limit |
| ⏳ Future Phase | should reset rate limit after TTL window |

---

## 4. Works E2E Test Plan (`test/works.e2e-spec.ts`)

> All tests in this section are ⏳ Future Phase (Phase 4)

### `POST /works`
- ⏳ should create a work when authenticated
- ⏳ should return 401 when not authenticated

### `GET /works`
- ⏳ should return paginated list of works

### `GET /works/my`
- ⏳ should return works owned by the authenticated user
- ⏳ should return 401 when not authenticated

### `GET /works/:id`
- ⏳ should return work details
- ⏳ should return 404 for nonexistent work

### `PATCH /works/:id`
- ⏳ should update work when owner
- ⏳ should return 403 when not the owner
- ⏳ should return 401 when not authenticated

### `DELETE /works/:id`
- ⏳ should delete work when owner
- ⏳ should return 403 when not the owner

### `GET /works/:id/collaborators`
- ⏳ should list collaborators for a work

---

## 5. Pages E2E Test Plan (`test/pages.e2e-spec.ts`)

> All tests in this section are ⏳ Future Phase (Phase 5)

### `POST /works/:workId/pages`
- ⏳ should add a page as the work author
- ⏳ should submit a contribution as a collaborator
- ⏳ should return 401 when not authenticated

### `GET /works/:workId/pages`
- ⏳ should return approved pages (public)

### `GET /works/:workId/pages/pending`
- ⏳ should return pending contributions (owner only)
- ⏳ should return 403 when not the owner

### `GET /works/:workId/pages/:number`
- ⏳ should return specific page by number
- ⏳ should return 404 for nonexistent page number

### `PATCH /pages/:id`
- ⏳ should update page when author
- ⏳ should return 403 when not the author

### `DELETE /pages/:id`
- ⏳ should delete page when author
- ⏳ should return 403 when not the author

### `POST /pages/:id/approve`
- ⏳ should approve contribution (owner only)
- ⏳ should return 403 when not the work owner

### `DELETE /pages/:id/reject`
- ⏳ should reject contribution (owner only)
- ⏳ should return 403 when not the work owner
