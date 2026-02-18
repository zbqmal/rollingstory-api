# 📚 RollingStory API - Backend Service

> **Live API:** [https://rollingstory-api-prod.up.railway.app](https://rollingstory-api-prod.up.railway.app)  
> **API Documentation:** [https://rollingstory-api-prod.up.railway.app/api](https://rollingstory-api-prod.up.railway.app/api)  
> **Frontend Repository:** [rollingstory-web](https://github.com/zbqmal/rollingstory-web)

## 🎯 About RollingStory

**RollingStory** is a collaborative storytelling platform where users can create original works (novels, stories) and invite others to contribute pages. Each work has an author who can approve or reject page contributions, creating an engaging community-driven writing experience.

### Key Features
- 📝 Create and manage collaborative stories
- 👥 Invite contributors to add pages
- ✅ Author approval system for contributions
- 📄 Page-by-page reading experience
- 🔐 Secure JWT-based authentication
- 📖 Interactive API documentation (Swagger)

---

## 🚀 About This Repository

This is the **backend API service** for RollingStory, built with **NestJS** and **TypeScript**. It provides:

- **RESTful API endpoints** for authentication, story management, and page contributions
- **PostgreSQL database** with Prisma ORM for type-safe data access
- **JWT authentication** with Passport.js
- **Real-time Swagger documentation** at `/api` endpoint
- **Comprehensive test coverage** with Jest (unit + e2e tests)
- **Production-ready deployment** on Railway

---

## 🏗️ System Architecture

### Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | NestJS 11 | TypeScript-first Node.js framework |
| **Language** | TypeScript 5.7 | Type-safe development |
| **Database** | PostgreSQL 15 | Relational database |
| **ORM** | Prisma 5 | Type-safe database client |
| **Authentication** | JWT + Passport.js | Secure token-based auth |
| **Password Hashing** | bcrypt 6.0 | Secure password storage |
| **API Documentation** | Swagger/OpenAPI | Interactive API docs |
| **Testing** | Jest + Supertest | Unit & E2E testing |
| **Validation** | class-validator | DTO validation |
| **Package Manager** | Yarn 4.12 | Fast, reliable dependencies |
| **Deployment** | Railway | Cloud platform |
| **Development** | GitHub Copilot | AI-assisted coding |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     RollingStory API                         │
│                                                               │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │   Client    │ → │   NestJS     │ → │   PostgreSQL    │  │
│  │  (Next.js)  │   │  Controllers │   │   + Prisma ORM  │  │
│  └─────────────┘   └──────────────┘   └─────────────────┘  │
│         ↓                  ↓                     ↓            │
│    JWT Token      ┌────────────────┐      ┌──────────────┐  │
│  Authentication   │  Business      │      │   Database   │  │
│                   │   Services     │ ←──→ │   Models     │  │
│                   └────────────────┘      └──────────────┘  │
│                          ↓                                    │
│                   ┌─────────────┐                            │
│                   │  Guards &   │                            │
│                   │  Validation │                            │
│                   └─────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── app.module.ts          # Root application module
├── main.ts                # Application entry point + Swagger config
│
├── auth/                  # Authentication module
│   ├── auth.module.ts
│   ├── auth.controller.ts # POST /auth/register, /login
│   ├── auth.service.ts    # Auth business logic
│   ├── jwt.strategy.ts    # JWT Passport strategy
│   ├── jwt-auth.guard.ts  # Route protection guard
│   └── dto/               # Data transfer objects
│
├── works/                 # Story/Work management module
│   ├── works.module.ts
│   ├── works.controller.ts # CRUD for stories
│   ├── works.service.ts    # Business logic
│   └── dto/
│
├── pages/                 # Page & contribution module
│   ├── pages.module.ts
│   ├── pages.controller.ts # CRUD + approve/reject
│   ├── pages.service.ts
│   └── dto/
│
└── prisma/                # Database module
    ├── prisma.module.ts
    ├── prisma.service.ts   # Database client
    └── schema.prisma       # Database schema
```

### Database Schema

```prisma
User {
  id              String (UUID)
  email           String (unique)
  username        String (unique)
  password        String (bcrypt hashed)
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
  pageNumber  Int? (nullable - assigned on approval)
  status      String (default: "pending")
  createdAt   DateTime
  approvedAt  DateTime?
  
  // Relations
  work        Work
  author      User
}

WorkCollaborator {
  id         String (UUID)
  workId     String
  userId     String
  approvedAt DateTime
  
  // Relations
  work       Work
  user       User
}
```

### API Endpoints

#### Authentication (`/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and receive JWT token
- `GET /auth/me` - Get current user profile (protected)

#### Works/Stories (`/works`)
- `POST /works` - Create new work (protected)
- `GET /works` - List all works (paginated, public)
- `GET /works/my` - Get user's works (protected)
- `GET /works/:id` - Get work details (public)
- `PATCH /works/:id` - Update work (owner only)
- `DELETE /works/:id` - Delete work (owner only)
- `GET /works/:id/collaborators` - List collaborators

#### Pages (`/works/:workId/pages`, `/pages`)
- `POST /works/:workId/pages` - Add page or contribute (protected)
- `GET /works/:workId/pages` - List approved pages (public)
- `GET /works/:workId/pages/pending` - View pending contributions (owner)
- `GET /works/:workId/pages/:number` - Get specific page (public)
- `PATCH /pages/:id` - Update page (author only)
- `DELETE /pages/:id` - Delete page (author only)
- `POST /pages/:id/approve` - Approve contribution (owner only)
- `DELETE /pages/:id/reject` - Reject contribution (owner only)

**Full interactive API documentation available at `/api` endpoint.**

---

## 🛠️ Local Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Yarn 4.12+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/zbqmal/rollingstory-api.git
   cd rollingstory-api
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/rollingstory"
   JWT_SECRET="your-super-secret-jwt-key-min-64-chars"
   PORT=3001
   NODE_ENV=development
   ```

4. **Start PostgreSQL with Docker** (optional)
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations**
   ```bash
   yarn prisma migrate dev
   ```

6. **Start the development server**
   ```bash
   yarn start:dev
   ```

7. **Access the API**
   - API: http://localhost:3001
   - Swagger Documentation: http://localhost:3001/api
   - Health Check: http://localhost:3001/health

### Running Tests

```bash
# Unit tests
yarn test

# E2E tests
yarn test:e2e

# Test coverage
yarn test:cov
```

### Database Management

```bash
# Generate Prisma Client after schema changes
yarn prisma generate

# Create a new migration
yarn prisma migrate dev --name migration_name

# View database in Prisma Studio
yarn prisma studio
```

---

## 🚀 Production Deployment

### Deployment Platform: Railway

The API is deployed on [Railway](https://railway.app) with automatic deployments from the `main` branch.

**Live Endpoints:**
- Production API: https://rollingstory-api-prod.up.railway.app
- Development API: https://rollingstory-api-dev.up.railway.app

### Environment Variables (Production)

```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=production-secret-key-min-64-chars
PORT=3001
NODE_ENV=production
```

### Deployment Process

1. Push changes to `main` branch
2. Railway automatically triggers build and deployment
3. Database migrations run automatically via Prisma
4. New version is deployed with zero downtime

---

## 🤝 Development

This project was built with the assistance of **GitHub Copilot**, leveraging AI-powered code suggestions to accelerate development and maintain code quality.

### Key Development Tools
- **NestJS CLI** - Generate modules, controllers, services
- **Prisma CLI** - Database migrations and schema management
- **ESLint** - Code linting and style enforcement
- **Prettier** - Code formatting
- **Jest** - Testing framework

---

## 📝 License

This project is [UNLICENSED](LICENSE) - Private portfolio project.

---

## 🔗 Related Projects

- **Frontend**: [rollingstory-web](https://github.com/zbqmal/rollingstory-web) - Next.js web application
- **Live Demo**: [https://rollingstory-web-prod.vercel.app](https://rollingstory-web-prod.vercel.app)

---

**Built with ❤️ using NestJS, TypeScript, and GitHub Copilot**
