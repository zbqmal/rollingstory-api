# Like System Implementation Plan — `rollingstory-api`

> **Created:** 2026-03-03 02:53:44  
> **Branch strategy:** Create `feature/like-system` from `dev` → open PR back to `dev`  
> **Scope:** Backend implementation for the Like feature across Stories and Pages

---

## Table of Contents

1. [Overview & Design Decision](#1-overview--design-decision)
2. [Phase 1 — Database Schema](#2-phase-1--database-schema)
3. [Phase 2 — NestJS Likes Module](#3-phase-2--nestjs-likes-module)
4. [Phase 3 — Update Existing Endpoints](#4-phase-3--update-existing-endpoints)
5. [Phase 4 — Tests](#5-phase-4--tests)
6. [Files Changed / Created](#6-files-changed--created)
7. [Cross-Repo Reference](#7-cross-repo-reference)

---

## 1. Overview & Design Decision

### What we're building

Authenticated users can **like** or **unlike**:
- A **Story** (Work)
- A **Page** within a Story

All endpoints require authentication. Guest users are redirected to `/login` on the frontend.

### Database strategy: Option A (Counter Column + Normalized Like Table)

| Approach | Read Performance | Write Complexity | Consistency |
|---|---|---|---|
| **Option A — Counter column** ✅ | O(1) — read `likesCount` directly | Medium — atomic transaction required | High — DB unique constraint |
| Option B — COUNT(*) on each request | O(n) index scan per request | Low | High |

**Why Option A is best at scale:**

- `COUNT(*)` is fine at 10K rows, catastrophic at 10M+. Even with an index, it requires scanning all matching rows.
- A pre-computed `likesCount` column gives **O(1) reads** — the overwhelmingly common operation.
- `Prisma.$transaction()` ensures the counter and the `Like` record are **always in sync** — no dirty reads possible.
- The `UNIQUE(userId, workId)` and `UNIQUE(userId, pageId)` constraints enforce **one-like-per-user** at the database level, making it impossible to double-count even under concurrent requests.
- This is the same strategy used by Instagram, Twitter/X, and YouTube for their like/reaction counters.

---

## 2. Phase 1 — Database Schema

### 2.1 New `Like` model in `prisma/schema.prisma`

```prisma
model Like {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  workId    String?
  work      Work?    @relation(fields: [workId], references: [id], onDelete: Cascade)
  pageId    String?
  page      Page?    @relation(fields: [pageId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  // Enforce one like per user per story and per page at the DB level.
  // These constraints make duplicate likes physically impossible — not just a service-layer check.
  @@unique([userId, workId])
  @@unique([userId, pageId])

  // Indexes for fast lookups when loading like counts or checking user's liked state
  @@index([workId])
  @@index([pageId])
  @@index([userId])
}
```

### 2.2 Add `likesCount` to `Work` and `Page`

```prisma
model Work {
  // ... existing fields ...
  likesCount  Int    @default(0)  // Denormalized counter; incremented/decremented atomically
  likes       Like[]
}

model Page {
  // ... existing fields ...
  likesCount  Int    @default(0)  // Same pattern as Work
  likes       Like[]
}
```

### 2.3 Add `likes` relation to `User`

```prisma
model User {
  // ... existing fields ...
  likes Like[]
}
```

### 2.4 Run migration

```bash
npx prisma migrate dev --name add_likes_system
npx prisma generate
```

---

## 3. Phase 2 — NestJS Likes Module

### 3.1 File structure

```
src/likes/
  likes.module.ts
  likes.controller.ts
  likes.service.ts
  dto/
    like-response.dto.ts
```

### 3.2 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/works/:id/like` | Like a story |
| `DELETE` | `/works/:id/like` | Unlike a story |
| `POST` | `/pages/:id/like` | Like a page |
| `DELETE` | `/pages/:id/like` | Unlike a page |

All four endpoints:
- Require `@UseGuards(JwtAuthGuard)`
- Return `LikeResponseDto`

### 3.3 Response DTO

```typescript
// src/likes/dto/like-response.dto.ts
export class LikeResponseDto {
  likesCount: number;
  isLiked: boolean;
}
```

### 3.4 Service logic (pseudocode)

```typescript
// Like a story — atomic: create Like record + increment counter in one transaction
async likeStory(storyId: string, userId: string): Promise<LikeResponseDto> {
  return this.prisma.$transaction(async (tx) => {
    // Prisma throws on unique constraint violation (duplicate like) → caught as ConflictException
    await tx.like.create({ data: { userId, workId: storyId } });

    const work = await tx.work.update({
      where: { id: storyId },
      data: { likesCount: { increment: 1 } },
    });

    return { likesCount: work.likesCount, isLiked: true };
  });
}

// Unlike a story — atomic: delete Like record + decrement counter
async unlikeStory(storyId: string, userId: string): Promise<LikeResponseDto> {
  return this.prisma.$transaction(async (tx) => {
    // Throws if Like record doesn't exist → caught as NotFoundException
    await tx.like.delete({
      where: { userId_workId: { userId, workId: storyId } },
    });

    const work = await tx.work.update({
      where: { id: storyId },
      // MAX(likesCount - 1, 0) guard: prevents going below zero in edge cases
      data: { likesCount: { decrement: 1 } },
    });

    return { likesCount: Math.max(work.likesCount, 0), isLiked: false };
  });
}

// Same pattern for unlikePage.
```

### 3.5 Error handling

| Scenario | HTTP Status |
|----------|-------------|
| Already liked (unique constraint) | 409 Conflict |
| Unlike when not liked (record not found) | 404 Not Found |
| Story/page does not exist | 404 Not Found |
| Not authenticated | 401 Unauthorized |

---

## 4. Phase 3 — Update Existing Endpoints

### 4.1 `works.service.ts` — include `likesCount` and `isLikedByCurrentUser`

When returning `Work` objects from `GET /works` and `GET /works/:id`:

- Always include `likesCount` (already on the model, zero extra query).
- When the requesting user is authenticated, compute `isLikedByCurrentUser` with a **batched query** (zero N+1):

```typescript
// ✅ One query for all stories in the list — NOT one query per story
const likedWorkIds = await this.prisma.like.findMany({
  where: { userId, workId: { in: storyIds } },
  select: { workId: true },
});
const likedSet = new Set(likedWorkIds.map(l => l.workId));

// Attach to each story
return stories.map(story => ({
  ...story,
  isLikedByCurrentUser: likedSet.has(story.id),
}));
```

### 4.2 `pages.service.ts` — same pattern

Apply the identical batched lookup for pages when returning page lists.

### 4.3 Controller changes

- Pass the authenticated user (from `@Request() req`) to the service methods for the `isLikedByCurrentUser` field.
- For guest requests (no auth token), `isLikedByCurrentUser` defaults to `false`.

---

## 5. Phase 4 — Tests

### 5.1 Unit tests — `src/likes/likes.service.spec.ts`

| Test | Description |
|------|-------------|
| `likeStory` — success | Creates Like record + increments `likesCount` |
| `likeStory` — duplicate | Throws `ConflictException` (409) |
| `unlikeStory` — success | Deletes Like record + decrements `likesCount` |
| `unlikeStory` — not liked | Throws `NotFoundException` (404) |
| `likePage` — success | Creates Like record + increments page `likesCount` |
| `unlikePage` — success | Deletes Like record + decrements page `likesCount` |
| Counter never goes below 0 | `Math.max(count, 0)` guard verified |

### 5.2 E2E tests — `test/likes.e2e-spec.ts`

| Test | Description |
|------|-------------|
| `POST /works/:id/like` — authenticated | Returns 201 with `{ likesCount, isLiked: true }` |
| `DELETE /works/:id/like` — authenticated | Returns 200 with `{ likesCount, isLiked: false }` |
| `POST /works/:id/like` — unauthenticated | Returns 401 |
| `POST /works/:id/like` — duplicate | Returns 409 |
| `POST /pages/:id/like` — authenticated | Returns 201 with correct response |
| `DELETE /pages/:id/like` — not liked | Returns 404 |

---

## 6. Files Changed / Created

| Action | File | Notes |
|--------|------|-------|
| ✏️ Modify | `prisma/schema.prisma` | Add `Like` model; add `likesCount` to `Work` and `Page` |
| ➕ Create | `prisma/migrations/[timestamp]_add_likes_system/` | Auto-generated by `prisma migrate dev` |
| ➕ Create | `src/likes/likes.module.ts` | NestJS module |
| ➕ Create | `src/likes/likes.controller.ts` | 4 endpoints |
| ➕ Create | `src/likes/likes.service.ts` | Core business logic |
| ➕ Create | `src/likes/dto/like-response.dto.ts` | Response shape |
| ➕ Create | `src/likes/likes.service.spec.ts` | Unit tests |
| ✏️ Modify | `src/works/works.service.ts` | Include `likesCount` + `isLikedByCurrentUser` |
| ✏️ Modify | `src/works/works.controller.ts` | Pass user to service |
| ✏️ Modify | `src/pages/pages.service.ts` | Same as works |
| ✏️ Modify | `src/pages/pages.controller.ts` | Pass user to service |
| ✏️ Modify | `src/app.module.ts` | Register `LikesModule` |
| ➕ Create | `test/likes.e2e-spec.ts` | E2E tests |

---

## 7. Cross-Repo Reference

The **frontend implementation plan** lives at:

```
rollingstory-web/docs/LIKE_SYSTEM_PLAN.md
```

See that file for:
- `LikeButton` component design
- Optimistic UI + rollback pattern
- i18n keys (EN / ES / KO)
- Integration points in the component tree

---

> **Note:** This file is a planning artifact. It can be deleted or moved to a wiki after the feature is merged.
