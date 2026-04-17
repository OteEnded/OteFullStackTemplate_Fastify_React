# Ote's FullStack Template

Reusable full-stack starter built around Fastify for the backend and React + Vite for the frontend.

This template is designed to let you start quickly with a practical structure instead of an empty shell. It gives you a working backend, a working frontend, optional PostgreSQL + Sequelize support, and a simple example feature that shows the full data flow from UI to API to database.

## Stack

- Backend: Fastify
- Frontend: React + Vite
- CSS tooling: Tailwind CSS configured via PostCSS, plus shipped custom stylesheet examples
- Database: PostgreSQL + Sequelize
- Runtime: Node.js
- Optional extras: cron scaffold, websocket scaffold, config-driven logging

## Template Structure

```text
Backend/
  app/
  database/
  lib/
  public/
  config.example.json
  config.json
  server.js

Frontend/
  public/
  src/
  package.json
  vite.config.ts

AI_CarryOn.md
AI_ProgressTracking.md
AI_TemplateCreation.md
```

## How It Works

- `Frontend/` is the React app used during development.
- `Backend/` is the Fastify server.
- Frontend production builds output into `Backend/public/dist`.
- Fastify serves both API routes and the built frontend.
- Database support is optional and can stay disabled until a project needs it.

## Included Example Flow

This template keeps one small generic example feature so the starter stays useful:

- backend example API under `/api/template-items`
- backend metadata endpoint under `/api/template/meta`
- frontend overview page at `/`
- frontend example items page at `/items`

The example feature is intended to be replaced with your real project domain.

## Quick Start

PowerShell note:

- If `npm` is blocked by PowerShell execution policy on Windows, use `npm.cmd` instead.

### 1. Install dependencies

Backend:

```bash
cd Backend
npm install
```

Frontend:

```bash
cd Frontend
npm install
```

### 2. Prepare config

Backend local config:

```bash
cd Backend
cp config.example.json config.json
```

Windows PowerShell:

```powershell
Copy-Item config.example.json config.json
```

Frontend runtime config already includes a local starter config in `Frontend/public/config.json`.

### 3. Run development servers

Backend:

```bash
cd Backend
npm run dev
```

Frontend:

```bash
cd Frontend
npm run dev
```

### 4. Build frontend for Fastify hosting

```bash
cd Frontend
npm run build
```

That outputs the frontend into `Backend/public/dist`.

## Verification

The template was rechecked on 2026-04-17 with these results:

- frontend production build completed successfully
- backend booted successfully with the default config
- workspace diagnostics were clean

## Backend Notes

The backend starter includes:

- plugin-based bootstrapping
- request, message, and query logging
- optional DB initialization
- API route registration
- SPA/static asset serving
- cron scaffold
- websocket scaffold

Main backend endpoints:

- `GET /api/health`
- `GET /api/template/meta`
- `GET /api/template-items`
- `POST /api/template-items`
- `PATCH /api/template-items/:id`

## Frontend Notes

The frontend starter includes:

- React Router setup
- runtime config loading from `public/config.json`
- Tailwind CSS tooling configured and ready to use
- starter overview page
- starter example CRUD-style page
- shipped UI styling that is mostly implemented in `src/index.css`
- build output configured for Fastify hosting

## Database Notes

Database is disabled by default in `Backend/config.json` and `Backend/config.example.json`.

To enable it:

1. Set `database.enabled` to `true`
2. Fill in `database.connection`
3. Review `database.sync.force` and `database.sync.alter` carefully before using real data

If enabled, the template can seed the example `TemplateItems` data for development.

## Suggested First Changes For A New Project

- Rename package names and project labels
- Replace the example `TemplateItems` feature with your real models and routes
- Update the frontend overview text and styling to match your project
- Add your own API modules under `Backend/app/routes/api/`
- Add your business logic under `Backend/app/services/`
- Remove any starter parts you do not need, such as cron or websocket scaffolds

## AI Tracking Files

This template keeps three root AI support files for longer projects:

- `AI_CarryOn.md`: short current-state handoff for the project implementer
- `AI_ProgressTracking.md`: append-only implementation history for the project implementer
- `AI_TemplateCreation.md`: template-maintainer design and cleanup notes

The first two are meant to be reused by the next project built from this template.

`AI_TemplateCreation.md` is for template-maintainer tracking and stays separate from project-implementation history.

## Philosophy

This template is intentionally not empty.

The goal is to give you:

- enough structure to move fast
- enough example code to understand the intended flow
- enough flexibility to strip it down or scale it up depending on the next project
