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
| ✅ Added in Phase 6 | should delete account and return 200 |
| ✅ Added in Phase 6 | should return 401 after account deletion |
| ✅ Added in Phase 6 | should return 401 when not authenticated |
| ✅ Added in Phase 6 | should return 409 if user has authored works |

### Rate Limiting

| Status | Test |
|--------|------|
| ✅ Added in Phase 6 | should return 429 after exceeding rate limit |
| ⏳ Deferred — see test comment | should reset rate limit after TTL window |

---

## 4. Works E2E Test Plan (`test/works.e2e-spec.ts`) — ✅ Phase 3

### `POST /works`

| Status | Test |
|--------|------|
| ✅ Added in Phase 3 | should return 401 if not authenticated |
| ✅ Added in Phase 3 | should create a new work with all fields |
| ✅ Added in Phase 3 | should create a work with only required fields (defaults applied) |
| ✅ Added in Phase 3 | should return 400 if title is missing |
| ✅ Added in Phase 3 | should return 400 if title is too short (< 3 chars) |
| ✅ Added in Phase 3 | should return 400 if title is too long (> 200 chars) |

### `GET /works`

| Status | Test |
|--------|------|
| ✅ Added in Phase 3 | should return empty list when no works exist |
| ✅ Added in Phase 3 | should return list of works with pagination metadata |
| ✅ Added in Phase 3 | should paginate correctly with page and limit params |
| ✅ Added in Phase 3 | should be accessible without authentication |

### `GET /works/my`

| Status | Test |
|--------|------|
| ✅ Added in Phase 3 | should return 401 if not authenticated |
| ✅ Added in Phase 3 | should return only the authenticated user's works |
| ✅ Added in Phase 3 | should return empty array if user has no works |

### `GET /works/:id`

| Status | Test |
|--------|------|
| ✅ Added in Phase 3 | should return work details by id |
| ✅ Added in Phase 3 | should return 404 if work does not exist |
| ✅ Added in Phase 3 | should be accessible without authentication |

### `PATCH /works/:id`

| Status | Test |
|--------|------|
| ✅ Added in Phase 3 | should return 401 if not authenticated |
| ✅ Added in Phase 3 | should update work title as owner |
| ✅ Added in Phase 3 | should update allowCollaboration flag |
| ✅ Added in Phase 3 | should return 403 if not the owner |
| ✅ Added in Phase 3 | should return 404 if work does not exist |

### `DELETE /works/:id`

| Status | Test |
|--------|------|
| ✅ Added in Phase 3 | should return 401 if not authenticated |
| ✅ Added in Phase 3 | should delete work as owner |
| ✅ Added in Phase 3 | should return 403 if not the owner |
| ✅ Added in Phase 3 | should return 404 if work does not exist |

---

## 5. Pages E2E Test Plan (`test/pages.e2e-spec.ts`) — ✅ Phase 5

### `POST /works/:workId/pages`

| Status | Test |
|--------|------|
| ✅ Added in Phase 5 | should return 401 if not authenticated |
| ✅ Added in Phase 5 | should create a page with status approved when owner posts |
| ✅ Added in Phase 5 | should assign sequential page numbers to owner pages |
| ✅ Added in Phase 5 | should create a page with status pending when non-owner contributes |
| ✅ Added in Phase 5 | should return 403 if collaboration is disabled and user is not owner |
| ✅ Added in Phase 5 | should return 400 if content exceeds pageCharLimit |
| ✅ Added in Phase 5 | should return 400 if content is empty |
| ✅ Added in Phase 5 | should return 404 if work does not exist |

### `GET /works/:workId/pages`

| Status | Test |
|--------|------|
| ✅ Added in Phase 5 | should return empty array when work has no approved pages |
| ✅ Added in Phase 5 | should return only approved pages |
| ✅ Added in Phase 5 | should return pages ordered by pageNumber ascending |
| ✅ Added in Phase 5 | should be accessible without authentication |

### `GET /works/:workId/pages/pending`

| Status | Test |
|--------|------|
| ✅ Added in Phase 5 | should return 401 if not authenticated |
| ✅ Added in Phase 5 | should return pending contributions as work owner |
| ✅ Added in Phase 5 | should return 403 if not the work owner |
| ✅ Added in Phase 5 | should return empty array when there are no pending contributions |

### `GET /works/:workId/pages/:number`

| Status | Test |
|--------|------|
| ✅ Added in Phase 5 | should return a specific approved page by number |
| ✅ Added in Phase 5 | should return 404 if page number does not exist |
| ✅ Added in Phase 5 | should be accessible without authentication |
| ✅ Added in Phase 5 | should return 400 when page number is not a valid integer |

### `PATCH /pages/:id`

| Status | Test |
|--------|------|
| ✅ Added in Phase 5 | should return 401 if not authenticated |
| ✅ Added in Phase 5 | should update page content as the page author |
| ✅ Added in Phase 5 | should return 403 if not the page author |
| ✅ Added in Phase 5 | should return 400 if updated content exceeds pageCharLimit |
| ✅ Added in Phase 5 | should return 404 if page does not exist |
| ✅ Added in Phase 5 | should return 403 when trying to update a pending page |

### `DELETE /pages/:id`

| Status | Test |
|--------|------|
| ✅ Added in Phase 5 | should return 401 if not authenticated |
| ✅ Added in Phase 5 | should delete a page as the author and reorder subsequent pages |
| ✅ Added in Phase 5 | should return 403 if not the page author |
| ✅ Added in Phase 5 | should return 404 if page does not exist |
| ✅ Added in Phase 5 | should return 403 when trying to delete a pending page |

### `POST /pages/:id/approve`

| Status | Test |
|--------|------|
| ✅ Added in Phase 5 | should return 401 if not authenticated |
| ✅ Added in Phase 5 | should approve a pending contribution as work owner |
| ✅ Added in Phase 5 | should assign correct page number to approved contribution (after existing approved pages) |
| ✅ Added in Phase 5 | should return 403 if not the work owner |
| ✅ Added in Phase 5 | should return 400 if page is already approved |
| ✅ Added in Phase 5 | should return 404 if page does not exist |

### `DELETE /pages/:id/reject`

| Status | Test |
|--------|------|
| ✅ Added in Phase 5 | should return 401 if not authenticated |
| ✅ Added in Phase 5 | should reject and permanently delete a pending contribution as work owner |
| ✅ Added in Phase 5 | should return 403 if not the work owner |
| ✅ Added in Phase 5 | should return 400 if page is not pending (e.g., already approved) |
| ✅ Added in Phase 5 | should return 404 if page does not exist |

### `GET /works/:workId/collaborators`

| Status | Test |
|--------|------|
| ✅ Added in Phase 5 | should return empty array when no collaborators exist |
| ✅ Added in Phase 5 | should return collaborators with page counts after approving contributions |
| ✅ Added in Phase 5 | should not count pending contributions in collaborators |
| ✅ Added in Phase 5 | should return 404 if work does not exist |
| ✅ Added in Phase 5 | should be accessible without authentication |
