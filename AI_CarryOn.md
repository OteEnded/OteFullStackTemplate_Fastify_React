# AI_CarryOn.md

> Purpose: short handoff for any AI agent continuing template work in this workspace.
> Last updated: 2026-04-17

## Current Goal

This repository is now a reusable full-stack template and is being finalized for GitHub publication.

Current primary target:

- `Backend/` and `Frontend/` are the reusable full-stack template pair.
- Root AI tracking files stay neutral so future template work can continue cleanly.
- Keep the repository publish-ready and easy to clone into the next project.

## Current State

### Full-stack template status

- `Backend/` runs as a generic Fastify backend starter.
- `Frontend/` runs as a generic React + Vite starter.
- Frontend build outputs to `Backend/public/dist`.
- Backend serves SPA assets and exposes example endpoints:
  - `/api/health`
  - `/api/template/meta`
  - `/api/template-items`
- Database is optional by config and disabled by default in the live template config.

### Example feature kept in template

- A small `TemplateItems` model exists to show the full stack path:
  - Sequelize model
  - seed file
  - Fastify CRUD-style route
  - React example page
- This sample is intended to be replaced by the next real project domain.

### Backend conventions preserved from Fastify starter

- plugin-based server bootstrap
- config-driven logging
- optional DB init
- route split
- static file serving
- cron and websocket scaffolds

## Key Files

### Full-stack template

- `Backend/server.js`
- `Backend/config.example.json`
- `Backend/app/routes/api/template-item.route.js`
- `Backend/database/models/template_item.model.js`
- `Backend/database/seeds/seed_template_items.js`
- `Frontend/src/App.tsx`
- `Frontend/src/pages/HomePage.tsx`
- `Frontend/src/pages/ExampleItemsPage.tsx`

### Planning / AI context

- `AI_TemplateCreation.md` = template cleanup decisions and direction
- `AI_CarryOn.md` = short current-state handoff
- `AI_ProgressTracking.md` = append-only work history

## Known Remaining Cleanup

- No active source cleanup blockers remain.
- `.history/` folders contain editor snapshots and are not part of the template source.
- Generated logs should not be treated as template content.

## Verification State

- Frontend build succeeded with `npm.cmd run build`.
- Backend booted successfully with database disabled and served `public/dist` on port `3000`.
- Workspace diagnostics were clean after the main refactor.
- Final pre-publish recheck was completed on 2026-04-17.

## Git State

- Git is initialized in the workspace root: `c:\data\FullStackTemplate_Fastify_React`
- Current branch: `main`
- Remote: not configured yet
- Commits: none yet, the repository is still at its initial uncommitted state

Current untracked working tree:

- `.gitignore`
- `AI_CarryOn.md`
- `AI_ProgressTracking.md`
- `Backend/`
- `Frontend/`
- `README.md`

Notes:

- `AI_TemplateCreation.md` is intentionally ignored by git.
- `Backend/config.json` is ignored through `Backend/.gitignore`.
- Frontend build output under `Backend/public/dist/` is ignored at the root level.

## Commit Message Policy

Use a consistent commit format:

- `OteEnded[feat]: ...`
- `OteEnded[fix]: ...`
- `OteEnded[refactor]: ...`
- `OteEnded[docs]: ...`
- `OteEnded[chore]: ...`

Examples:

- `OteEnded[feat]: add initial fullstack template structure`
- `OteEnded[refactor]: replace checklist flow with generic template items`
- `OteEnded[docs]: add root template README`

Git workflow policy:

- Do not commit automatically after every edit.
- Commit only when the user explicitly asks for a commit.
- Before committing, re-check `git status` and make sure ignored files stay out of the commit.
- If a remote is added later, record it in this file.
- After the first commit, update this section with the latest commit hash and any configured GitHub remote.

## Suggested Next Steps

1. Push the initial repository state to GitHub.
2. Optionally remove stale editor-history artifacts from the repo if a cleaner public template is desired.
3. Start the next project by replacing the example `TemplateItems` flow with the real domain.