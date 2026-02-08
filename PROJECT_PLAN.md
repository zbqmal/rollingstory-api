# RollingStory - Project Plan & Architecture

> **Last Updated:** 2026-02-08  
> **Status:** Phase 1 Complete ✅ | Phase 2 Complete ✅ | Phase 3 Ready 🚀

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

### 📝 Phase 3: Page Management

#### Phase 3.1: Backend - Page CRUD API 📋
**Repository:** `rollingstory-api`

**To Implement:**
- [ ] Pages module
- [ ] DTOs (create-page.dto.ts)
- [ ] Authorization
  - Check if work allows collaboration
  - Validate page number sequence
  - Enforce character limit
- [ ] Service methods
  - `addPage()` - Add new page to work
  - `getPages()` - Get all pages for a work
  - `getPage()` - Get single page
  - `updatePage()` - Update page content (author only)
  - `deletePage()` - Delete page (author only, adjust page numbers)

**Endpoints:**
```
POST   /works/:workId/pages          - Add new page
GET    /works/:workId/pages          - List all pages for work
GET    /works/:workId/pages/:number  - Get specific page
PATCH  /pages/:id                    - Update page (author only)
DELETE /pages/:id                    - Delete page (author only)
```

**Business Rules:**
- Page numbers must be sequential
- Content must not exceed work's pageCharLimit
- Only work owner or approved collaborators can add pages
- Only page author can edit/delete their page
- Deleting a page reorders subsequent pages

#### Phase 3.2: Frontend - Page Reading & Writing UI 📋
**Repository:** `rollingstory-web`

**To Implement:**
- [ ] API client for pages
- [ ] Pages
  - `/works/[id]` - Enhanced with page list
  - `/works/[id]/pages/new` - Add new page form
  - `/works/[id]/pages/[number]` - View single page
  - `/works/[id]/pages/[number]/edit` - Edit page
- [ ] Components
  - `PageCard` - Display single page
  - `PageForm` - Form with character counter
  - `PageList` - Paginated list
  - `PageNavigation` - Previous/Next buttons
- [ ] Features
  - Character counter (visual feedback near limit)
  - Markdown preview (optional)
  - Read mode vs Edit mode
  - Page navigation

---

### 👥 Phase 4: Collaboration

#### Phase 4.1: Backend - Collaboration API 📋
**Repository:** `rollingstory-api`

**To Implement:**
- [ ] Collaborators module
- [ ] DTOs (add-collaborator.dto.ts)
- [ ] Service methods
  - `requestCollaboration()` - User requests to collaborate
  - `approveCollaborator()` - Owner approves request
  - `removeCollaborator()` - Remove collaborator
  - `getCollaborators()` - List work collaborators
- [ ] Middleware
  - Check if user is owner or approved collaborator before allowing page creation

**Endpoints:**
```
POST   /works/:workId/collaborators/request  - Request to collaborate
POST   /works/:workId/collaborators/:userId/approve  - Approve collaborator (owner)
DELETE /works/:workId/collaborators/:userId  - Remove collaborator (owner)
GET    /works/:workId/collaborators          - List collaborators
```

**Business Rules:**
- Only works with `allowCollaboration: true` accept requests
- Only work owner can approve/remove collaborators
- Approved collaborators can add pages
- Collaborators cannot edit work settings

#### Phase 4.2: Frontend - Collaboration UI 📋
**Repository:** `rollingstory-web`

**To Implement:**
- [ ] Collaboration request button
- [ ] Collaborator management panel (owner view)
- [ ] Pending requests list
- [ ] Collaborator list display
- [ ] Notifications (optional)

---

### 🔍 Phase 5: Discovery & Polish

#### Phase 5.1: Search & Discovery 📋
**To Implement:**
- [ ] Search works by title/description
- [ ] Filter by type (novel/comic)
- [ ] Sort by popularity, recent, etc.
- [ ] Work categories/tags (optional)

#### Phase 5.2: User Profiles 📋
**To Implement:**
- [ ] Public user profile page
- [ ] User's published works
- [ ] User's contributed pages
- [ ] Bio and profile picture (optional)

#### Phase 5.3: Polish & Features 📋
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

**Note:** This document is a living document and will be updated as the project evolves. Last updated: 2026-02-08
