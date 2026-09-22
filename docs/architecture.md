# CMPC Libros — Architecture & Design Document

> Prueba Técnica Full Stack · CMPC Libros
> Stack: React + TypeScript (Frontend) · NestJS + TypeScript (Backend) · PostgreSQL (Database)

---

## 1. Overview

A full-stack web application that digitizes the book store inventory process for CMPC Libros.
The system provides authenticated access, advanced catalog exploration, CRUD maintenance
modules, CSV export, operation auditing, and role-based access control.

### Book domain data
| Field | Type |
|---|---|
| `title` | string |
| `author` | entity relation |
| `publisher` (editorial) | entity relation |
| `price` | decimal |
| `availability` | derived from `stock` (`IN_STOCK` when `stock > 0`) |
| `genre` | entity relation |

---

## 2. Architecture Decisions (ADR summary)

| # | Decision | Rationale |
|---|---|---|
| ADR-01 | **Monorepo with npm workspaces** (`apps/api`, `apps/web`) | Single repo delivery (required), shared tooling, one `npm install`, consistent versions |
| ADR-02 | **Layered modular backend** (controller → service → repository) | SOLID compliance; interfaces on repositories enable mocking in unit tests |
| ADR-03 | **Prisma ORM** with declarative `schema.prisma`, migrations, typed client | Explicit requirement; best DX + typed queries |
| ADR-04 | **JWT access token** only (no refresh token) | Sufficient for the test scope; reduced complexity/attack surface; documented as assumption |
| ADR-05 | **Role-based access control** (RBAC) via `RolesGuard` + `@Roles()` decorator | Admin-only maintenance modules; non-admin read-only access |
| ADR-06 | **Soft delete** on books (`deletedAt`) | Explicit requirement; queries filter `deletedAt IS NULL` by default |
| ADR-07 | **Audit log in dedicated table** (`AuditLog`) + structured logging | Tracks acting user (from JWT) per operation; survives user deletion via denormalized fields |
| ADR-08 | **Image storage: local disk via Docker volume** | Production-viable for single-instance; documented assumption (S3/Cloudinary swap is isolated in a storage service) |
| ADR-09 | **Conditional Swagger** via `SWAGGER_ENABLED` env var (default `true`) | API docs must not exist in production; module is not registered when disabled |
| ADR-10 | **Normalized data model** with indexes on frequent query paths | Requirement: "modelo de datos normalizado" + "índices para consultas frecuentes" |
| ADR-11 | **Global NestJS interceptors** for response shaping + audit capture | Explicit additional requirement |
| ADR-12 | **Server-side pagination, multi-field sorting, debounced search** | Explicit frontend/backend requirements |

---

## 3. System Architecture

```
┌────────────────────────────┐      ┌──────────────────────────────────────────┐
│         React Web           │ HTTP │              NestJS API                   │
│  apps/web (Vite + TS)       │─────▶│  apps/api                                 │
│  · Login / JWT storage      │      │  · Global interceptors (response+audit)  │
│  · Catalog list (filters,   │      │  · AuthGuard (JWT) + RolesGuard (@Roles) │
│    sort, pagination, search)│      │  · Modules: auth, users, books, authors, │
│  · CRUD forms + image upload│      │    publishers, genres, audit, export,    │
│  · Error handling           │      │    health                                │
└────────────────────────────┘      │  · Controllers → Services → Repositories  │
                                     │  · Swagger (conditional)                  │
                                     └───────────┬──────────────────────────────┘
                                                 │ Prisma (typed client)
                                                 ▼
                                     ┌────────────────────────────┐
                                     │       PostgreSQL            │
                                     │  (Docker, volume persisted) │
                                     └────────────────────────────┘
```

**Infrastructure** — `docker-compose.yml` orchestrates three services:
- `db` — PostgreSQL with named volume
- `api` — NestJS (multi-stage build, dev & prod profiles)
- `web` — React app (dev mode proxies API; prod served statically)

---

## 4. Data Model (Relational)

```
┌──────────────┐      ┌──────────────┐
│     Role     │      │   Publisher  │
│ id           │      │ id           │
│ code UNIQUE  │      │ name UNIQUE  │
│ name         │      └──────────────┘
│ description  │            │1
└──────────────┘            │
       │1                    │N
       │              ┌──────────────┐
       │N             │     Book     │
┌──────────────┐      │ id           │
│     User     │◀─────│ isbn UNIQUE  │
│ id           │      │ title        │
│ email UNIQUE │      │ description  │
│ passwordHash │N     │ price NUMERIC│
│ fullName     │      │ stock INT    │
│ isActive     │      │ availability │  ◀ derived: IN_STOCK if stock > 0
│ roleId FK    │      │ imageUrl     │
│ deletedAt    │      │ authorId FK  │1──▶ Author (id, name UNIQUE)
└──────────────┘      │ publisherId FK│──▶ Publisher
       │1             │ genreId FK   │1──▶ Genre (id, name UNIQUE)
       │N             │ deletedAt    │
┌────────────────┐    │ timestamps   │
│   AuditLog     │    └──────────────┘
│ id             │
│ userId FK NULL │  ◀ (kept NULL-able: system events)
│ userName       │  ◀ denormalized for readability
│ userRole       │  ◀ denormalized for readability
│ action         │  (CREATE | UPDATE | DELETE | LOGIN | EXPORT | ...)
│ entityType     │  (BOOK | USER | AUTH | ...)
│ entityId       │
│ method, path   │
│ details JSONB  │
│ ipAddress      │
│ createdAt      │
└────────────────┘
```

### Relationships
- `User N:1 Role`
- `Book N:1 Author`, `Book N:1 Publisher`, `Book N:1 Genre`
- `AuditLog N:1 User` (nullable — system/attempted-login events)

### Indexes (frequent queries)
| Table | Index | Purpose |
|---|---|---|
| `Book` | `(authorId)` | filter by author |
| `Book` | `(publisherId)` | filter by editorial |
| `Book` | `(genreId)` | filter by genre |
| `Book` | `(availability)` | filter by availability |
| `Book` | `(title)` | full-text / ILIKE search |
| `AuditLog` | `(userId, createdAt)` | audit history by user |
| `AuditLog` | `(entityType, entityId)` | audit history by entity |

---

## 5. Roles & Access Matrix

| Capability | ADMIN | OPERADOR | CONSULTA |
|---|:---:|:---:|:---:|
| View catalog (list/detail/search) | ✅ | ✅ | ✅ |
| Export CSV | ✅ | ✅ | ❌ |
| Book maintenance (create/update/delete) | ✅ | ❌ | ❌ |
| User management (create/deactivate users, roles) | ✅ | ❌ | ❌ |
| View audit log | ✅ | ❌ | ❌ |

**Assumptions**
1. No public user registration — users are provisioned by ADMIN (requirement only asks for login).
2. Every endpoint requires a valid session (nothing is public).
3. JWT `role` claim drives authorization at endpoint level.

---

## 6. Backend Design (NestJS)

### Module layout
```
apps/api/src/
├── main.ts                 (conditional Swagger, global prefix, validation pipe)
├── app.module.ts           (ConfigModule.global, module composition)
├── config/                 (env validation via Joi or class-validator)
├── common/
│   ├── interceptors/       (ResponseInterceptor, AuditInterceptor)
│   ├── guards/             (JwtAuthGuard, RolesGuard)
│   ├── decorators/         (@Roles, @CurrentUser)
│   ├── filters/            (HttpExceptionFilter — unified error shape)
│   └── repositories/       (BaseRepository pattern, PrismaService)
└── modules/
    ├── health/             (GET /api/health — liveness)
    ├── auth/               (POST /api/auth/login → JWT)
    ├── users/              (admin-only user CRUD)
    ├── books/              (CRUD + soft delete + list query)
    ├── authors/            (light maintenance)
    ├── publishers/         (light maintenance)
    ├── genres/             (light maintenance)
    ├── audit/              (admin-only audit query)
    └── export/             (GET /api/books/export.csv)
```

### Key mechanisms
- **Auth**: `POST /api/auth/login` validates credentials (bcrypt), returns signed JWT `{ sub, role, ... }` (12h default expiry — documented assumption).
- **RBAC**: `JwtAuthGuard` attaches user; `RolesGuard` reads `@Roles()` metadata and compares with JWT claim.
- **Soft delete**: `deletedAt` timestamp; service-layer default scope filters it out.
- **Transactions**: Prisma `$transaction` for critical multi-write operations (e.g., book creation chain, audit + mutation consistency).
- **Audit**: global interceptor captures `{ user, action, entityType, entityId, method, path, details, ip }` and persists to `AuditLog` asynchronously (fire-and-forget with graceful failure — audit must never break the business operation).
- **Error handling**: global exception filter returns `{ ok: false, error: { code, message, details? } }`; frontend displays humanized messages.
- **Export**: `GET /api/books/export?filters...` streams CSV with UTF-8 BOM (Excel compatibility), respects current filters.

### API response shape (via interceptor)
```json
{ "ok": true, "data": {...} }
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "message": "...", "details": [...] } }
```

---

## 7. Frontend Design (React + TypeScript)

```
apps/web/src/
├── app/providers (api-client, auth session)
├── features/
│   ├── auth/        (login screen, session storage, redirect-on-401)
│   ├── books/       (list + table with filters/sort/pagination/search debounce)
│   ├── book-form/   (create/edit with reactive validation + image upload)
│   ├── book-detail/ (read-only detail view)
│   ├── users/       (admin-only)
│   └── audit/       (admin-only)
├── shared/          (UI components, error display, formatters)
└── router (role-aware navigation: admin sees maintenance modules)
```

### Key mechanisms
- **Auth flow**: login → store JWT (httpOnly cookie via API or localStorage per deployment; default httpOnly cookie with CORS — documented assumption) → refresh on 401 via redirect.
- **Catalog list**: server-side pagination (`page`, `pageSize`), multi-column sort (`sortBy[]`, `order[]`), advanced filters (genre/publisher/author/availability), debounced search (300 ms) against `GET /api/books`.
- **Reactive validation**: per-field + form-level validation with immediate feedback (e.g., `react-hook-form` + `zod` schemas shared with backend contract).
- **Image upload**: multipart form on book create/update; preview before submit.
- **Error handling**: centralized API client that normalizes `{ ok:false }` responses into user-facing toasts/field errors.

---

## 8. Configuration & Environment

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://cmpc:cmpc@db:5432/cmpc_books` | Prisma connection (Docker) |
| `JWT_SECRET` | *(required in prod)* | Signing secret |
| `JWT_EXPIRES_IN` | `12h` | Access token TTL |
| `SWAGGER_ENABLED` | `true` | `false` in production → Swagger module is not registered |
| `PORT` | `3000` | API port |
| `NODE_ENV` | `development` | Runtime profile |

`.env.example` is committed; real secrets live in `.env` (gitignored) / docker secrets.

---

## 9. Milestones (work plan)

| # | Milestone | Delivers | PDF mapping |
|---|---|---|---|
| M0 | Foundations | git, monorepo, docker-compose, health, conditional Swagger | DevOps §1, Docs §1 |
| M1 | Data layer | Prisma schema (normalized), migration, seed (roles, admin, demo data) | DB §1–2 |
| M2 | Auth & users | JWT login, RBAC guards, admin user module, bcrypt | Front §1, Back §2 |
| M3 | Books CRUD | REST endpoints, soft delete, validation, image upload, transactions | Front §3, Back §3,5 |
| M4 | Catalog & export | filters, multi-sort, server pagination, debounced search, CSV export | Front §2, Back §4 |
| M5 | Audit & logging | global audit interceptor, AuditLog, structured logging, admin query | Back §6, Add. §2 |
| M6 | Frontend complete | login UI, list, form, detail, error handling, role-aware nav | Front 1–4, Add. §1 |
| M7 | Quality & delivery | tests ≥80%, README, Swagger docs, diagrams, final polish | Testing, Docs, Entrega |

---

## 10. Testing Strategy

- **Backend (Jest + Supertest)**: unit tests for services & controllers with mocked repositories; integration for auth flow.
- **Frontend (Vitest)**: component tests for list, form, login; service tests for API client, debounce logic.
- **Coverage target ≥ 80%** across both apps.
- Repositories are mocked at the interface boundary (SOLID + fast units).

---

## 11. Documentation Deliverables

- `README.md` — setup, usage, architecture summary, design decisions (link to this doc).
- Swagger/OpenAPI — auto-generated at `/api/docs` (when enabled).
- Architecture diagram — Mermaid in this doc; exportable.
- Relational model — Mermaid `erDiagram` in this doc; dbdiagram-style representation.

---

## 12. Documented Assumptions (explicit requirement of the exercise)

1. No refresh-token rotation; single JWT access token with 12h TTL.
2. No public registration; ADMIN provisions users.
3. All endpoints require authentication.
4. Images stored on local disk via Docker volume (S3-ready interface documented).
5. `availability` is derived from `stock` (no separate boolean).
6. Audit writes are best-effort (never block the business transaction).
7. CSV export uses current applied filters; UTF-8 BOM for Excel compatibility.
8. Dev web app proxies `/api` to backend; production profile serves built static files via a simple static server or front-proxy.