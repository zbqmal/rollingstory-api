# RollingStory - Project Plan & Architecture

> **Last Updated:** 2026-02-15  
> **Status:** Phase 1 Complete ✅ | Phase 2 Complete ✅ | Phase 3 Complete ✅ | Phase 4 Complete ✅ | Phase 5 Ready 🚀

---

## 📖 Project Overview

**RollingStory** is a collaborative storytelling platform where users can create and contribute to novels page by page. Think of it as a "choose your own adventure" meets "collaborative writing" platform.

### Core Concept
- Authors create "Works" (novels/stories)
- Each work consists of multiple "Pages"
- Pages have character limits (default: 2000 chars)
- Authors can enable collaboration
- Collaborators can add new pages to continue the story
- Stories grow organically through community contributions

---

## 🏗️ Architecture

### Technology Stack

#### Backend: `rollingstory-api`
- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT (Passport)
- **Password Hashing:** bcrypt
- **Testing:** Jest + Supertest (E2E)
- **Port:** 3001

#### Frontend: `rollingstory-web`
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** Custom React hooks + module-level state
- **Testing:** Jest + React Testing Library
- **Port:** 3000

---

## 📊 Database Schema

### Models

```prisma
User {
  id              String (UUID)
  email           String (unique)
  username        String (unique)
  password        String (hashed)
  createdAt       DateTime
  updatedAt       DateTime
  
  // Relations
  authoredWorks   Work[]
  pages           Page[]
  collaborations  WorkCollaborator[]
}

Work {
  id                  String (UUID)
  type                String (default: "novel")
  title               String
  description         String?
  authorId            String
  pageCharLimit       Int (default: 2000)
  allowCollaboration  Boolean (default: true)
  createdAt           DateTime
  updatedAt           DateTime
  
  // Relations
  author              User
  pages               Page[]
  collaborators       WorkCollaborator[]
}

Page {
  id          String (UUID)
  workId      String
  authorId    String
  content     String (Text)
  pageNumber  Int
  createdAt   DateTime
  
  // Relations
  work        Work
  author      User
  
  // Constraints
  @@unique([workId, pageNumber])
}

WorkCollaborator {
  id         String (UUID)
  workId     String
  userId     String
  approvedAt DateTime
  
  // Relations
  work       Work
  user       User
  
  // Constraints
  @@unique([workId, userId])
}
```

---

## 🎯 Development Phases

### ✅ Phase 1: Foundation & Authentication (COMPLETE)

#### Phase 1.1: Backend Setup ✅
**Repository:** `rollingstory-api`

**Implemented:**
- [x] NestJS project initialization
- [x] Prisma setup with PostgreSQL
- [x] Database schema design
- [x] Auth module (register, login, JWT)
- [x] Password hashing with bcrypt
- [x] JWT strategy & guards
- [x] GetUser decorator
- [x] Auth DTOs with validation
- [x] Unit tests (auth.controller.spec.ts, auth.service.spec.ts)
- [x] E2E tests (auth.e2e-spec.ts)
- [x] CORS enabled
- [x] Global validation pipe

**Endpoints:**
```
POST   /auth/register    - Register new user
POST   /auth/login       - Login user
GET    /auth/me          - Get current user (protected)
```

#### Phase 1.2: Frontend Setup ✅
**Repository:** `rollingstory-web`

**Implemented:**
- [x] Next.js 15 project initialization
- [x] TypeScript configuration
- [x] Tailwind CSS setup
- [x] API client (`lib/api.ts`)
  - Generic request handler
  - Token management
  - Error handling (ApiError)
- [x] Auth system (`lib/auth.ts`)
  - Centralized state management
  - Subscriber pattern
  - Initialize, register, login, logout
  - Token storage (localStorage key: "tk")
- [x] useAuth hook (`lib/use-auth.ts`)
  - React integration
  - Automatic initialization
  - Ready state tracking
- [x] TypeScript types (`types/index.ts`)
  - User, AuthResponse, Work, Page
- [x] UI Components
  - Header (auth-aware navigation)
  - Footer
  - Home page
  - Login page (`/login`)
  - Register page (`/register`)
- [x] Jest + Testing Library setup
- [x] Comprehensive tests
  - lib/auth.test.ts
  - lib/use-auth.test.ts
  - lib/api.test.ts

**Routes:**
```
/                    - Home page (welcome + CTA)
/login               - Login form
/register            - Registration form
```

---

### ✅ Phase 2: Work Management (COMPLETE)

#### Phase 2.1: Backend - Work CRUD API ✅
**Repository:** `rollingstory-api`

**Implemented:**
- [x] Works module creation
  - `src/works/works.module.ts`
  - `src/works/works.controller.ts`
  - `src/works/works.service.ts`
- [x] DTOs
  - `src/works/dto/create-work.dto.ts`
  - `src/works/dto/update-work.dto.ts`
- [x] Authorization guards
  - Check work ownership for update/delete
  - Allow public read for works
- [x] Service methods
  - `create()` - Create new work
  - `findAll()` - List all works (with pagination)
  - `findMyWorks()` - Get current user's works
  - `findOne()` - Get work by ID (with pages count)
  - `update()` - Update work (only owner)
  - `remove()` - Delete work (only owner)
- [x] Tests
  - `works.controller.spec.ts`
  - `works.service.spec.ts`
  - `works.e2e-spec.ts`

**Endpoints:**
```
POST   /works              - Create new work (protected)
GET    /works              - List all works (public, paginated)
GET    /works/my           - Get current user's works (protected)
GET    /works/:id          - Get work by ID (public)
PATCH  /works/:id          - Update work (protected, owner only)
DELETE /works/:id          - Delete work (protected, owner only)
```

> All endpoints tested and working.

**Authorization Rules:**
- Only authenticated users can create works
- Only work owners can update/delete their works
- Anyone can view works (read-only)
- Deleting a work cascades to pages and collaborators

**Validation:**
- Title: required, 3-200 chars
- Type: "novel" (default, "comic" future)
- PageCharLimit: 100-10000 (default: 2000)
- AllowCollaboration: boolean (default: true)

#### Phase 2.2: Frontend - Work Management UI ✅
**Repository:** `rollingstory-web`

**Implemented:**
- [x] API client extensions (`lib/api.ts`)
  - `api.works.create(dto)`
  - `api.works.getAll(page?, limit?)`
  - `api.works.getMy()`
  - `api.works.getById(id)`
  - `api.works.update(id, dto)`
  - `api.works.delete(id)`
- [x] Pages
  - `/works` - Browse all works (public)
  - `/works/new` - Create new work form (protected)
  - `/works/my` - User's own works dashboard (protected)
  - `/works/[id]` - View work details + pages
  - `/works/[id]/edit` - Edit work form (owner only)
- [x] Components
  - `WorkCard` - Display work preview card
  - `WorkForm` - Reusable form for create/edit
  - `WorkList` - Grid/list of work cards
  - `WorkDeleteButton` - Confirmation dialog
- [x] Features
  - Search and filter works
  - Pagination
  - Protected routes (redirect to login)
  - Owner-only actions (edit/delete buttons)
  - Loading states
  - Error handling
- [x] Tests
  - Component tests
  - API integration tests

---

### ✅ Phase 3: Page Management (COMPLETE)

#### Phase 3.1: Backend - Page CRUD API ✅
**Repository:** `rollingstory-api`

**Implemented:**
- [x] Pages module
  - `src/pages/pages.module.ts`
  - `src/pages/pages.controller.ts`
  - `src/pages/pages.service.ts`
- [x] DTOs
  - `src/pages/dto/create-page.dto.ts`
  - `src/pages/dto/update-page.dto.ts`
- [x] Authorization
  - Check if user is work owner or approved collaborator
  - Validate page number sequence (automatic)
  - Enforce character limit
- [x] Service methods
  - `create()` - Add new page to work
  - `findAll()` - Get all pages for a work
  - `findOne()` - Get single page by number
  - `update()` - Update page content (author only)
  - `remove()` - Delete page (author only, auto-reorder subsequent pages)
- [x] Tests
  - `pages.controller.spec.ts`
  - `pages.service.spec.ts`
  - `pages.e2e-spec.ts`

**Endpoints:**
```
POST   /works/:workId/pages          - Add new page (owner/collaborator)
GET    /works/:workId/pages          - List all pages (public)
GET    /works/:workId/pages/:number  - Get specific page (public)
PATCH  /pages/:id                    - Update page (author only)
DELETE /pages/:id                    - Delete page (author only, reorders)
```

✅ **All endpoints tested and working**

**Business Rules:**
- Only work owner or approved collaborators can create pages
- Page numbers are automatically assigned sequentially
- Content must not exceed work's `pageCharLimit`
- Only page author can edit/delete their page
- Deleting a page automatically reorders subsequent pages

#### Phase 3.2: Frontend - Page Reading & Writing UI ✅
**Repository:** `rollingstory-web`

**Implemented:**
- [x] API client extensions (`lib/api.ts`)
  - `api.pages.create(workId, dto)`
  - `api.pages.getAll(workId)`
  - `api.pages.getByNumber(workId, pageNumber)`
  - `api.pages.update(pageId, dto)`
  - `api.pages.delete(pageId)`
- [x] Pages
  - `/works/[id]` - Enhanced with real page list
  - `/works/[id]/pages/new` - Add new page form
  - `/works/[id]/pages/[number]` - View/read single page
  - `/works/[id]/pages/[number]/edit` - Edit page
- [x] Components
  - `PageCard` - Display single page preview
  - `PageForm` - Form with live character counter
  - `PageList` - Grid of page cards
  - `PageNavigation` - Previous/Next navigation
  - `PageDeleteButton` - Delete with confirmation
- [x] Features
  - Real-time character counter with color coding (green/yellow/red)
  - Visual feedback near limit
  - Clean reading layout with good typography
  - Page navigation (prev/next/jump to)
  - Protected routes (redirect to login)
  - Author-only edit/delete buttons
  - Loading states and skeletons
  - Error handling and validation
- [x] Tests
  - Component tests for all page components
  - API integration tests

---

### ✅ Phase 4: Page Contribution System (COMPLETE)

#### Phase 4.1: Backend - Page Contribution API ✅
**Repository:** `rollingstory-api`

**Implemented:**
- [x] Database migration - Added `status` field to `Page` model
- [x] Added `approvedAt` timestamp field
- [x] Made `pageNumber` nullable (assigned only when approved)
- [x] Updated Pages service methods
  - `create()` - Owner pages approved immediately, non-owner pages pending
  - `getPendingContributions()` - Owner views pending contributions
  - `approveContribution()` - Approve and assign page number
  - `rejectContribution()` - Delete rejected contribution
- [x] Updated existing endpoints to filter approved pages only
- [x] New controller endpoints
  - `GET /works/:workId/pages/pending` - View pending (owner only)
  - `POST /pages/:id/approve` - Approve contribution (owner only)
  - `DELETE /pages/:id/reject` - Reject contribution (owner only)
- [x] Removed old collaborators module (user-based collaboration)
- [x] Tests
  - Updated `pages.service.spec.ts`
  - Updated `pages.controller.spec.ts`
  - Updated `pages.e2e-spec.ts`

**Endpoints:**
```
POST   /works/:workId/pages          - Submit page (owner: approved, contributor: pending)
GET    /works/:workId/pages          - List approved pages only (public)
GET    /works/:workId/pages/:number  - Get specific approved page (public)
GET    /works/:workId/pages/pending  - View pending contributions (owner only)
POST   /pages/:id/approve            - Approve contribution (owner only)
DELETE /pages/:id/reject             - Reject contribution (owner only)
PATCH  /pages/:id                    - Update page (author only)
DELETE /pages/:id                    - Delete page (author only)
```

✅ **All endpoints tested and working**

**Business Rules:**
- Any authenticated user can submit page contributions to collaborative works
- Work owner's pages are immediately approved with page number
- Non-owner submissions start as `status = "pending"` with `pageNumber = null`
- Only work owner can view, approve, or reject pending contributions
- Approved contributions get assigned next sequential page number
- Rejected contributions are permanently deleted
- Only approved pages appear in public page lists
- Page authors can edit/delete their own approved pages

---

### 📝 Phase 5: Documentation Updates

#### Phase 5.1: Update PROJECT_PLAN.md Files ✅
**Repository:** Both `rollingstory-api` and `rollingstory-web`

**Completed:**
- [x] Updated status to reflect Phase 4 completion
- [x] Documented Phase 4 implementation details
- [x] Added Phase 5, 6, and 7 planning
- [x] Updated last modified date

---

### 🎨 Phase 6: UI/UX Style Improvements

**Note:** All Phase 6 changes are frontend-only in `rollingstory-web` repository. No backend changes needed.

#### Phase 6.1: Color Scheme & Background Redesign 📋
**Repository:** `rollingstory-web`

**To Implement:**
- [ ] Change background from black to white/light gray
- [ ] Update content cards with subtle borders
- [ ] Add proper shadows for depth
- [ ] Maintain white/light backgrounds for cards
- [ ] Update global color palette in Tailwind config

#### Phase 6.2: Typography & Contrast Enhancement 📋
**Repository:** `rollingstory-web`

**To Implement:**
- [ ] Improve text contrast ratios (WCAG AA compliant)
- [ ] Fix faint text colors (placeholders, labels, inputs)
- [ ] Update input field text colors for readability
- [ ] Ensure all text is readable on light backgrounds
- [ ] Update button text colors
- [ ] Fix form field placeholders

#### Phase 6.3: Rename "Work" to "Story" (Frontend Only) 📋
**Repository:** `rollingstory-web`

**To Implement:**
- [ ] Rename all "Work" references to "Story" in UI text
- [ ] Update route names (`/works` → `/stories`)
- [ ] Update component names (WorkCard → StoryCard, etc.)
- [ ] Update TypeScript types for display
- [ ] Keep API calls unchanged (backend still uses "works")

**Important:** Backend endpoints and database remain unchanged. Only frontend display names affected.

---

### 🚀 Phase 7: Behavior Enhancements

#### Phase 7.1: Homepage Redesign - Show All Stories 📋
**Repository:** `rollingstory-web`

**To Implement:**
- [ ] Remove "Welcome to Rolling Story" landing page
- [ ] Make homepage (`/`) show all published stories
- [ ] Allow non-registered users to browse and read stories
- [ ] Keep navigation bar with Login/Register links
- [ ] Redirect root path to story list view

**New User Flow:** Visit Site → See All Stories → Browse/Read → (Optional) Register to Contribute

#### Phase 7.2: Add Collaborators Section to Story Detail Page 📋

**Backend Changes (rollingstory-api):**
- [ ] Add/enhance endpoint: `GET /works/:id/collaborators`
- [ ] Return list of contributors with page counts
- [ ] Include only users with approved pages
- [ ] Sort by page count (descending), then alphabetically

**Frontend Changes (rollingstory-web):**
- [ ] Add "Collaborators" section on story detail page
- [ ] Fetch and display contributor list
- [ ] Show max 5 collaborators, truncate with "..." if more
- [ ] Display username with contribution count
- [ ] Compact, non-intrusive design

---

### 🔍 Phase 8: Discovery & Polish

#### Phase 8.1: Search & Discovery 📋
**To Implement:**
- [ ] Search works by title/description
- [ ] Filter by type (novel/comic)
- [ ] Sort by popularity, recent, etc.
- [ ] Work categories/tags (optional)

#### Phase 8.2: User Profiles 📋
**To Implement:**
- [ ] Public user profile page
- [ ] User's published works
- [ ] User's contributed pages
- [ ] Bio and profile picture (optional)

#### Phase 8.3: Polish & Features 📋
**To Implement:**
- [ ] Dark mode
- [ ] Mobile responsiveness improvements
- [ ] SEO optimization
- [ ] Open Graph meta tags
- [ ] RSS feed for new works/pages
- [ ] Email notifications (optional)
- [ ] Export work to PDF/EPUB (optional)

---

## 🔐 Security Considerations

### Authentication
- JWT tokens stored in localStorage (key: "tk")
- Tokens expire after 7 days
- Passwords hashed with bcrypt (10 rounds)
- No password in API responses

### Authorization
- JWT guard protects all authenticated routes
- Owner-only checks for update/delete operations
- Collaborator checks for page creation
- Input validation on all DTOs

### Best Practices
- CORS enabled for frontend origin
- Global validation pipe (whitelist, forbidNonWhitelisted)
- Error messages don't leak sensitive info
- SQL injection prevention (Prisma parameterized queries)

---

## 🧪 Testing Strategy

### Backend Tests
- **Unit Tests:** All services and controllers
- **E2E Tests:** All endpoint flows
- **Test Database:** Separate test DB, cleaned between tests
- **Coverage Goal:** >80%

### Frontend Tests
- **Unit Tests:** Utility functions, hooks, components
- **Integration Tests:** API client
- **E2E Tests:** Critical user flows (optional, Playwright)
- **Coverage Goal:** >70%

---

## 📦 Deployment Strategy

### Backend (`rollingstory-api`)
**Recommended Platforms:**
- Railway
- Render
- Heroku
- AWS/GCP/Azure

**Environment Variables:**
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
PORT=3001
NODE_ENV=production
```

**Deployment Steps:**
1. Push to GitHub
2. Connect to platform
3. Set environment variables
4. Auto-deploy on push
5. Run migrations: `yarn prisma migrate deploy`

### Frontend (`rollingstory-web`)
**Recommended Platforms:**
- Vercel (recommended for Next.js)
- Netlify
- Railway

**Environment Variables:**
```bash
NEXT_PUBLIC_API_URL=https://your-api.com
```

**Deployment Steps:**
1. Push to GitHub
2. Connect to Vercel
3. Set environment variable
4. Auto-deploy on push

---

## 🔄 Development Workflow

### For Each Phase:

1. **Backend First (API)**
   ```bash
   # Create PR via Copilot
   "Create a PR for Phase X.1: [Feature] in rollingstory-api"
   
   # Manual testing
   cd rollingstory-api
   yarn start:dev
   # Test endpoints with Postman/Insomnia
   yarn test
   
   # Review, merge PR
   ```

2. **Frontend Second (UI)**
   ```bash
   # Create PR via Copilot
   "Create a PR for Phase X.2: [Feature] in rollingstory-web"
   
   # Manual testing
   cd rollingstory-web
   yarn dev
   # Test UI flows manually
   yarn test
   
   # Review, merge PR
   ```

3. **Integration Testing**
   - Start both servers
   - Test complete user flows
   - Verify data persistence
   - Check error handling

---

## 📝 API Documentation

### Base URL
- Development: `http://localhost:3001`
- Production: `https://api.rollingstory.com` (TBD)

### Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

### Response Format
All API responses follow this structure:
```json
{
  "data": {},
  "message": "Success message",
  "statusCode": 200
}
```

### Error Format
```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

---

## 🤝 Contributing

### Setup
1. Clone both repositories
2. Set up environment variables
3. Install dependencies: `yarn install`
4. Run database migrations: `yarn prisma migrate dev`
5. Start dev servers

### Code Style
- Follow existing patterns
- Run linters before commit
- Write tests for new features
- Keep commits atomic and descriptive

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Run full test suite
4. Create PR with clear description
5. Wait for review and CI checks
6. Merge after approval

---

## 📄 License

MIT License - See LICENSE file for details

---

## 📞 Contact

- **Project Repository:** [zbqmal/rollingstory-api](https://github.com/zbqmal/rollingstory-api)
- **Frontend Repository:** [zbqmal/rollingstory-web](https://github.com/zbqmal/rollingstory-web)

---

**Note:** This document is a living document and will be updated as the project evolves. Last updated: 2026-02-15
