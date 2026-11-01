# Smart Database Visualizer

A full-stack web application that connects to a **MySQL** database, reads its schema using `INFORMATION_SCHEMA`, and renders an **interactive React Flow ER diagram** in the browser — tables, columns, primary keys, foreign keys, indexes, and relationships are all discovered automatically. No hardcoding required.

> **Milestone 5 Completed**: React Flow visualization, Dagre auto-layout, 5-tab Table Explorer, unified search & focus, health analysis integration, structural statistics, and local view-state visual filters.
> 
> Detailed documentation is available at [docs/MILESTONE_5_DOCUMENTATION.md](docs/MILESTONE_5_DOCUMENTATION.md).

---

## Architecture

```
smart-database-visualizer/
├── frontend/          ← Next.js 16 + Tailwind (interactive ER diagram UI)
└── backend/           ← Node.js + Express REST API
    ├── src/
    │   ├── config/
    │   │   └── database.js         ← mysql2 connection pool factory
    │   ├── controllers/
    │   │   ├── databaseController.js  ← handles /api/database/*
    │   │   └── schemaController.js    ← handles /api/schema/*
    │   ├── services/
    │   │   ├── databaseService.js     ← connection test + pool creation
    │   │   └── schemaService.js       ← all INFORMATION_SCHEMA SQL queries
    │   ├── routes/
    │   │   ├── databaseRoutes.js      ← route definitions
    │   │   └── schemaRoutes.js
    │   ├── validators/
    │   │   └── databaseValidator.js   ← Zod schemas for input validation
    │   ├── middleware/
    │   │   ├── errorHandler.js        ← centralized error handler
    │   │   └── notFound.js            ← 404 handler
    │   └── server.js                  ← Express entry point
    ├── test-api.js    ← automated API test suite (23 tests)
    ├── .env           ← your credentials (never committed)
    └── .env.example   ← template
```

**Request flow:** Browser → Next.js → `lib/schema-api.ts` → Express → Controller → Service → MySQL

---

## Quick Start

### 1. Backend

```bash
cd backend
npm install

# Copy and fill in your credentials
copy .env.example .env
# Edit .env: set PORT, FRONTEND_URL (and optionally default DB vars)

npm run dev       # development with auto-reload
# or
npm start         # production
```

### 2. Frontend

```bash
cd frontend
pnpm install      # already done if node_modules exists

# Create the env file
echo NEXT_PUBLIC_API_URL=http://localhost:5000 > .env.local

pnpm dev          # runs on http://localhost:3000
```

### 3. Open the app

- Frontend: http://localhost:3000  
- Backend health: http://localhost:5000/api/health

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port the Express server listens on |
| `FRONTEND_URL` | `http://localhost:3000` | Allowed CORS origin |
| `DB_HOST` | `localhost` | Default MySQL host (optional — UI overrides) |
| `DB_PORT` | `3306` | Default MySQL port |
| `DB_USER` | `root` | Default MySQL user |
| `DB_PASSWORD` | *(empty)* | Default MySQL password |
| `DB_NAME` | *(empty)* | Default MySQL database name |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | Backend base URL |

---

## API Reference

All responses follow this shape:
```json
{ "success": true,  "data": { ... } }     // success
{ "success": false, "message": "..." }     // error
```

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |

### Database

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/database/test` | `{ host, port, user, password, database }` | Ping the DB, immediately disconnect |
| `POST` | `/api/database/connect` | `{ host, port, user, password, database }` | Connect + store pool for schema queries |

### Schema *(requires `/api/database/connect` first)*

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/schema/tables` | List all table names |
| `GET` | `/api/schema/tables/:tableName` | Columns, types, PK/FK/nullable info |
| `GET` | `/api/schema/relationships` | All foreign-key relationships |
| `GET` | `/api/schema/overview` | Full schema — ready for ER diagram |

---

## Sample Requests

**Test connection:**
```bash
curl -X POST http://localhost:5000/api/database/test \
  -H "Content-Type: application/json" \
  -d '{"host":"localhost","port":3306,"user":"root","password":"","database":"college_db"}'
```

**Connect and then fetch overview:**
```bash
curl -X POST http://localhost:5000/api/database/connect \
  -H "Content-Type: application/json" \
  -d '{"host":"localhost","port":3306,"user":"root","password":"","database":"college_db"}'

curl http://localhost:5000/api/schema/overview
```

---

## Running Tests

```bash
# Backend must be running first
cd backend
npm test
```

Runs 23 automated tests covering health, 404, Zod validation, bad credentials, SQL injection attempts, and connection guards.

---

## Security Features

| Feature | Implementation |
|---|---|
| HTTP headers | `helmet` |
| CORS restriction | `FRONTEND_URL` env var, not `*` |
| Rate limiting | 100 req / 15 min per IP (`express-rate-limit`) |
| Input validation | `zod` on all request bodies |
| Identifier safety | Regex allow-list `[a-zA-Z0-9_]` for table/DB names |
| Parameterized queries | All INFORMATION_SCHEMA queries use `?` placeholders |
| No password logging | Passwords never appear in server logs or API responses |
| Secret management | `.env` in `.gitignore` |

---

## MySQL Requirements

- MySQL 5.7+ or MySQL 8+
- User must have `SELECT` privilege on `INFORMATION_SCHEMA`
- The database you connect to must already exist

---

## For Your College Presentation

**The 4-layer architecture:**

1. **Routes** — receive the HTTP request, call the right controller
2. **Controllers** — validate input, call the right service, format the response
3. **Services** — contain all business logic and SQL queries
4. **Config** — manages the database connection pool

This separation means:
- You can change the database (e.g., add PostgreSQL support) by only changing the service layer
- You can change the API (e.g., add GraphQL) by only changing the route/controller layer
- Each file has one responsibility and is easy to explain

```
Browser → routes → controllers → services → MySQL
                ↓
         validators (Zod)
                ↓
         middleware (helmet, cors, rate-limit, errorHandler)
```
