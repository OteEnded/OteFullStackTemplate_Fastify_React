# AI_Standards — Ote's way of working

> **The canonical copy lives HERE, in the template** (`OteFullStackTemplate_Fastify_React`), since v2
> (2026-11-02 — Ote: *"that my way to work, hmmm should i ship it?"* → *"ok then"*). It was written
> 2026-08-12 in `C:\data\AI_LLMv2\Reference\docs\STANDARDS_OTE_WAY_OF_WORKING.md` (*"i want all, so these
> context can be pass on to other project as well"*); that copy keeps its workspace-only §7 and should point
> here for §1–§6 and §8.
>
> **Status: DESCRIPTIVE and PORTABLE.** §1–§6 port to ANY project of his — that's why every project built
> from this template ships it. Workspace-specific facts (machines, port maps, personas) do NOT belong here:
> write those in the project's own `AI_CarryOn.md`. Where a rule was learned the hard way, the incident is
> named so the rule keeps its reason. Template v2 changes are marked *(v2)*.

---

## §0 · How to use this doc in a new project

1. It is already here: a project built from the template inherits this file (keep it at the repo root).
2. The two working docs ship as blank starters: `AI_CarryOn.md` + `AI_ProgressTracking.md` at the root.
3. Fill the carry-on's `▶▶ START HERE` before writing any code, and append tracker entry #1.
4. When a convention changes in a project, change it here in the same commit — and tell Ote, so the
   template's copy can be updated too.

⚠️ **The docs are load-bearing infrastructure, not paperwork.** Every session starts cold. The carry-on
is what continuity is bought with, which is why a **stale line in it is worse than a missing one** — it
makes a fresh agent confidently wrong.

---

## §1 · The working-doc system — four roles, separated by WRITE DISCIPLINE

The seam between these files is not topic. It is **how each one is allowed to be written.** Mixing them
is the failure this system exists to prevent.

| Role | File | Write rule |
|---|---|---|
| **Current state** | `AI_CarryOn.md` (one per project + one at the workspace root) | **Rewritten in place.** Always true *now*. Long history banned. |
| **History** | `AI_ProgressTracking.md` (one per project) | **Append-only, newest at the BOTTOM.** Never edited after the fact. |
| **Cross-project history** | `AI_OverallProgressTracking.md` (workspace root only) | Append-only, **high-signal only**. |
| **Consult material** | `Reference/` | Read, don't edit. Never a working doc. |

### 1.1 · `AI_CarryOn.md` — the handoff

**Purpose:** what a *fresh* agent must know before touching anything, in one sitting.

Sections that recur across all three live carry-ons (OLS, Sotera, JustTTS):

- `▶▶ START HERE` — the entry point, first thing in the file. How to run it, how to test it, what state
  it is in.
- **What exists, and what only LOOKS like it exists.** ✅ built / ❌ not built. This section is the
  single highest-value one in the system: *"a dressed-up placeholder invites the mistake that it is
  finished."*
- **Decisions, with their reversibility** — *"all reversible; flagged rather than buried."*
- **Ownership** — which process/port/service is **his** to run and must never be started or killed.
- **Lessons that cost real time / the traps** — see 1.7.
- `Open — needs <owner>` — parked items, each with who owns the decision.
- `Next, in order` — the sequenced next actions.
- **Standing rules** — the short list of things that are always true for this project.

**Rules:**
- ⛔ **No implementation history.** That is the tracker's job. A carry-on that accumulates history stops
  being readable, and an unreadable carry-on is not read.
- ⚠️ **Correct stale lines INLINE, don't silently delete them.** The live pattern:
  *"⚠️ This line used to say 'the tables exist; nothing reads or writes them yet' and that stopped
  being true the moment he first talked to her."* A reader who trusted the old line needs to see it fall.
- ⚠️ **When a claim in here turns out to be WRONG, say so in the file.**
  *"THE CHAT KILL SWITCH IS REAL — I recorded the opposite here and it was wrong."*
- 🔑 **A carry-on that outgrows a sitting gets CUT, not trimmed.** OLS's reached 4,564 lines → the whole
  body moved to `Reference/docs/ARCHIVE_OteLLMServices_CarryOn_<date>.md` and the carry-on became a lean
  entry point that **points at it**: *"Do not re-derive; go read."* Cutting preserves the reasoning;
  trimming destroys it.
- The carry-on carries an **index table** (`topic → where`) once the project has more than a few docs.

### 1.2 · `AI_ProgressTracking.md` — append-only history

Header is fixed: `## Purpose`, `## Logging Rules`, `## Entry Template`, `## Entries`. Entry template,
verbatim:

```markdown
### YYYY-MM-DD HH:mm

- Summary:
- Files touched:
- Decisions:
- Next action:
```

**Rules:**
- Append after **each meaningful planning or implementation update** — not once a day, not per commit.
- **Newest at the bottom.** (Opposite of the carry-on, which is newest-first at the top.)
- ⚠️ **Get the real clock before writing a timestamp** — `Get-Date -Format "yyyy-MM-dd HH:mm:ss K"` on
  Windows PowerShell. Never estimate or infer a time.
- `Next action:` is the most-read field. Write it as the next *action*, not a wish.
- Cross-project work also gets a **brief mirror entry** in the workspace tracker (1.3) — brief, with a
  pointer, never a copy.

### 1.3 · `AI_OverallProgressTracking.md` — the workspace tracker

Same shape, different template and a much higher bar:

```markdown
### YYYY-MM-DD HH:mm

- Summary:
- Sub-projects affected:
- Decisions / direction changes:
- Next action:
```

Entries only for: cross-project decisions · a new sub-project scaffolded · architectural pivots ·
sequencing changes · **conventions adopted**. Its job is *"scan what changed across the workspace
without reading each sub-project's tracker."*

### 1.4 · `Reference/` — consult material, with a taxonomy

```
Reference/
  README.md          the live map — a "Consult it when…" TABLE, not a file list
  repos/             frozen reference source (read, don't edit)
  docs/              active reference + design docs
  docs/archive/      completed / superseded / shelved — kept for the RATIONALE, with its own README
  files/             imported assets
```

**Filename prefix = the doc's KIND** (status lives inside the doc, not in the name):

| Prefix | Kind |
|---|---|
| `RFC_` | a proposal / an argued design (`ACCEPTED`, `LIVE through Phase 3`, … stated at the top) |
| `PLAN_` | the concrete build sequencing under an RFC |
| `ANALYSIS_` / `RESEARCH_` | input that feeds a decision (own reads vs external research) |
| `ARCHIVE_` | a retired working doc kept whole (e.g. a cut carry-on) |
| `SECURITY_CASE_` | a real incident, kept for its methodology |
| `STANDARDS_` | this kind — how work is done |
| `REMOTE_RESOURCE_` | a machine/service outside this box |
| `Reference_<Thing>` | a digest of an external codebase, mapped to *our* contracts |

**Rules:**
- Every entry in `README.md` answers three columns: **what it is · what it is for · _Consult it when…_**
  A reference index that only lists files does not get used.
- ⚠️ **A digest of a LIVE clone goes stale silently.** If a reference repo is still pulling, the digest
  records the commit it was taken at and the doc says what to re-run after a pull.
- Retiring a doc = **move to `docs/archive/` with a status line saying what retired it**, and update
  both indexes. Never delete rationale.
- ⚠️ **Reference docs live at the WORKSPACE root**, one tree. A second `Reference/` inside a
  sub-project shadows the real one — don't create one.

### 1.5 · Bounded agent desks (the `AI_FeedbackAssist.md` pattern)

When a second agent gets a narrow job, it gets **a desk, not the keys**. One file, split by a line:

- **Above `## Analyst log`: instructions.** Its role in one sentence (*"analyst, not operator"*), an
  explicit **You DO** / **You do NOT** list, the exact allowed HTTP verbs, how to catch up on the
  project, the domain model it needs, and how to query — with runnable snippets.
- **Below: the running conversation** — `## Analyst log`, `## Builder log`, `## Ote's directives`, each
  entry stamped and in a fixed report format.

**Rules:** the desk is **gitignored** (it holds local credentials/queries) · its writes are limited to
that file plus a scratch dir · triage/decision actions are Ote's, code fixes are the builder's. The
value: two agents share state through a file with a **stated boundary**, and he directs through it.

### 1.6 · What git tracks, and why

| File | Tracked? | Why |
|---|---|---|
| `AI_CarryOn.md`, `AI_ProgressTracking.md` | ✅ **TRACKED** (his call, 2026-07-30) | A local-only carry-on got truncated once and was **irrecoverable**. *Continuity beats secrecy* — the repos are private. |
| `AI_FeedbackAssist.md`, `AI_TemplateCreation.md` | ⛔ ignored | Local desk / template-maintainer notes, not implementer history. |

⚠️ **The rule that comes with tracking them: NEVER paste a live credential into a working doc.** Git
history is permanent. Reference *where* a secret lives (`config.json`, the console), never its value. A
secret scan ran before tracking began, and it found one issued API key to redact.

### 1.7 · Writing conventions (they carry meaning — keep them)

- **Emoji are a status GRAMMAR, used consistently:** ✅ done/verified · ❌ not built · ⚠️ trap or
  caveat · ⛔ forbidden · 🔑 the key insight · ⭐ his decision · 🧊 frozen · ⏸ paused · ⏭ not ready ·
  🌱 new arc · 🚦 open items · 📦 the archive · ▶▶ start here.
- **Lessons are first-class content, with their cost attached** — a dedicated
  `⚠️ LESSONS THAT COST REAL TIME — do not re-derive these` section, or *"the five traps that already
  cost this project time."* Each lesson states the wrong belief, the evidence that broke it, and the
  rule. This is the section that makes the docs compound instead of just accumulate.
- **His words are QUOTED, with provenance.** Decisions he makes in conversation are recorded verbatim
  with conversation id, message id and timestamp — *"not paraphrased, not inferred."* A paraphrased
  decision is a rewritten decision.
- **Name the thing the reader would otherwise overestimate.** ❌ lists exist so nobody assumes.
- **Vocabulary is fixed once named** and then used (arcs, phases, component types). Renaming mid-project
  costs more than it looks.
- ⚠️ **Never edit these files with PowerShell pipelines or `node -e`** — `Get/Set-Content` mojibakes
  UTF-8, `node -e` breaks on quoting, and a JSON round-trip once mangled every em-dash in
  `config.example.json` into `â€"`. Use the editor's Edit/Write tools.

---

## §2 · Git

- **One repo per project, and the workspace root is NOT a repo.** `OteLLMServices/`,
  `OteAIComponentSDK/`, `Personas/Sotera/`, `Reference/` each have their own `.git`. Some trees are
  deliberately **ungitted** (`DevTools/`, `VoiceModels/`, `PortableComponents/`) — that is a decision,
  and giving one a repo is his call, not a default.
- ⛔ **Never `git init` inside a tree that is already inside another repo** — nested repos.
- **Commit message format: `OteEnded[type]: message`** with literal brackets.
  `feat | fix | refactor | docs | chore | test`. **No AI attribution, no `Co-Authored-By`.**
- 🔑 **The subject states the OUTCOME, not the action** — same rule as his reporting rule (§6). Real
  examples:
  - `OteEnded[fix]: root is two owner values, not one - key filters, token limits, and three tests`
  - `OteEnded[docs]: retiring a database is three objects - the role outlived it and could still log in`
  - `OteEnded[chore]: stop tracking node_modules - 140 dependency files were in the repo`
  A subject like *"update auth"* wastes the one line most likely to be read again.
- **Multi-line messages via `git commit -F <file>`**, never `-m` with a here-string (PowerShell quoting).
- ⛔ **Commit only when he asks.** Never auto-commit after an edit. Re-check `git status` before
  committing and keep ignored files out.
- **Never track `package-lock.json`** — each project regenerates it with `npm install`. Ignored at both
  root and `**/`.
- **Never track `node_modules/`.** ⚠️ It happened: 140 dependency files were committed under
  `test/node_modules`, and because a `file:` dependency is an npm **symlink**, one landed as an
  **embedded git repository** — which a clone silently cannot fetch. The `.gitignore` must exist
  *before* the first `npm install`, not after.
- **Annotated `vX.Y.Z` tag + push on every SDK/library version bump** (`OteAIComponentSDK` runs
  v0.5.0 → v0.6.4 this way). Application repos tag at real milestones (`OLS v1.0.0`), and **the tag
  message records what was verified AND what was left open** — deliberately, including a health run
  that came back red and was not diagnosed.
- **`.gitignore` groups with reasons written in it**, not a bare list: dependencies · lockfiles · build
  output · **secrets/local config** · logs (may contain auth headers) · cold storage · DB dumps · AI
  docs policy · editor/OS. The file doubles as documentation of *why* something is out.
- **`.gitattributes` normalizes line endings:** `* text=auto eol=lf`, but **`*.bat text eol=crlf`** —
  Windows batch files must stay CRLF to run — and binaries (`*.png|ico|woff…`) marked `binary`.
- **First commit of a project derived from the template is the PRISTINE template**, so every
  project-specific change reads as a diff against it.

---

## §3 · Stack and code conventions

- **Backend: JavaScript, ESM** (`"type": "module"`), **not TypeScript.** A deliberate reversal of an
  earlier TS-backend recommendation: runtime validation comes from **Fastify JSON Schema**, so the type
  layer would be paying for itself twice. **Frontend: TypeScript + React + Vite.** The split is intended.
- **Fastify 5** (`fastify-plugin`, `@fastify/cors|static|cookie|websocket`) · **`pg` +
  Sequelize 6** · `node-cron` for schedules · `bcryptjs` for hashes · `openid-client` for Login with
  Oteracount. *(v2)* Sessions are a sealed AES-256-GCM cookie on `node:crypto` — **not**
  `@fastify/secure-session`, whose `sodium-native` is a native module and would break the portable-EXE
  build (that recipe needs ZERO native modules).
- **One origin:** Fastify serves the API *and* the built frontend from `Backend/public/dist`; the
  frontend auto-detects `window.location.origin` so no base URL needs configuring.
- ⭐ **JSON config, NEVER `.env`** — *"i love to use json config and not prefer ..env that much."*
  - `Backend/config.json` **gitignored** + `Backend/config.example.json` **tracked** as the documented
    shape. Same pair on the frontend (`Frontend/public/config.json`).
  - **Nested key GROUPS**, not a flat namespace: `app · providers · chat · auth · console · components ·
    maintenance · security · usage · logging · database · api · memory`.
  - Verified: **there is not one `.env` in any code he owns.** (The only ones in the workspace are
    inside frozen third-party reference repos.)
  - 🔑 **A config-file key is also a SECURITY BOUNDARY**: things that must not be flippable at runtime
    live in `config.json` on purpose — e.g. the health suite's own enable flag, *"so it cannot be
    flipped by the suite it runs."*
  - ⚠️ **Edit `config.example.json`, never rewrite it** (the em-dash mangling above).
- **Modular = one directory per concern** under `Backend/app/` — the live shape is ~21 of them:
  `adapters · api-standards · audit · auth · chat · chat-runtime · components · config · files ·
  interaction · maintenance · plugins · routes · schedules · settings · streaming · todo · usage ·
  views · voice`, plus `database/{migrations,models,seeds}`, `lib/`, `providers/`.
- **Providers are swappable adapters**, one directory each (`providers/ollama`, `openai-compatible`,
  `anthropic`) behind a single interface — per-request data in (`host`, `model`, `messages`, `tools`,
  `options`), normalized events out. No global provider-config object.
- **Capabilities are separately versioned packages**, consumed as `file:` deps
  (`@ote/components-sdk`, `@ote/memory`) with a lockfile pin — `lockMode: update` in dev,
  `frozen` for deploys.
- 🔑 **A boundary goes where the GUARANTEE differs**, not where tables or concepts are shared. The
  question that decides an extraction: *"when this capability is not available, what does the system
  promise to do?"* Required and optional cannot share a contract, and the degradation should be a
  **tested** contract.
- **Launchers are OS-named and generated** *(v2)*: `wizard.bat`/`wizard.sh` run once and emit
  `run_*` (dev) and `server_*` (hosting / OteServerManager) at the repo root from `scripts/launchers/`; the
  generated ones are gitignored. The logic is ONE Node implementation (`scripts/lib/tasks.mjs`) — the
  `.bat`/`.sh` files are thin wrappers, so the two OSes can't drift.
  - ⭐ **No watch mode.** Ote: *"the --watch is not working properly so i enforce all coding agenty to do
    manual restat when update code."* Dev = install-if-package.json-changed + build frontend + migrate +
    start; after changing code, stop and start it again.
  - `server_*` is non-interactive and exits with the server's own exit code (a crash must never look like a
    clean stop to OteServerManager); `scripts/deploy_*` = pull + install + build + migrate, no start.
- **Ports are allocated, not picked at random** — Ote's rule **`XX YY Z`** in 08000–10999: zone `XX`,
  running id `YY`, variant `Z` (0 = the service, 1–9 = its own extra ports — a test instance is variant 1).
  Reserved in OteServerManager. *(v2)* The template's own default is **8080** (zone 08, id 08 — Ote:
  *"8080"*); a real project gets its own. Never 3000 — *"it collides with anything."*
- ⭐ **API surface is GET + POST only** *(v2)* — Ote: *"i like GET+POST-only style ... i think this is commom
  pattern"*. Updates/actions are `POST /:uuid` / `POST /:uuid/<action>`. The template refuses to boot if
  a route registers PATCH/PUT/DELETE (agents write REST verbs by habit — so it's enforced, not documented).
- ⭐ **Response envelope** *(v2)*: `{ ok: true, data }` / `{ ok: false, message, code }` — Ote: *"for api
  use res shape {ok:true,data} / {ok:false, message, code}"*. `code` is a stable machine string.

---

## §4 · Database conventions

- **One database, one SCHEMA per project** (`ote_ai_toolbox` → `ote_llm_services`, `persona_sotera`).
  Shared extensions (pgvector) live in `public` so every schema uses them.
- **The app role is deliberately NOT a superuser.** DDL that needs one (e.g. `CREATE EXTENSION`) is a
  separate, named role whose password lives only in a local gitignored config — never in a tracked file,
  never guessed, never printed.
- ⚠️ **Apply migrations AS THE APP ROLE.** Applying as the superuser makes every table owned by it and
  **unwritable by the app**.
- ⭐ **The SQL migration is the SOURCE OF TRUTH; Sequelize models MIRROR it.**
  `database/migrations/001_core.sql` wins; `sync({ alter: false })` so sync can never quietly reshape a
  table. The reason is concrete: `sync` **cannot express** `NOT NULL` on an owner column, CHECK
  constraints, or partial indexes — exactly the guarantees that were later found missing elsewhere.
- **Table naming: a data-class prefix + ONE name end to end.**
  `mst_` what exists (config/identity/definitions) · `txn_` what happened or is in flight · `log_`
  append-only audit/telemetry. The model file, `sequelize.define()`, `tableName` and the `db.` accessor
  are **the same literal string** (`db.mst_user_roles`) — no name map, no helper (a helper adds a 4th
  name). A unit test fails if they drift.
- ⚠️ **Never hardcode a connection or a schema name in a script.** Read them from the app config through
  one helper that **throws** rather than returning a half-filled object. The failure mode is not an
  error: 56 scripts with their own copy of an old database name all *connected* — to real, months-stale
  data — and went **green against the wrong database**.
- ⚠️ **When a name moves, grep for the BARE token, not the punctuation you expect around it.** Searching
  `schema.` with the dot reported zero leftovers and missed ~40 more (`{ project: 'x' }`,
  `table_schema='x'`, `const S = 'x'`). Worst shape: `information_schema` probes return **0 rows** for a
  schema that isn't there, which every `add-column` script reads as *"the column is missing."*
- ⚠️ **Retiring a database is THREE objects, not one:** database, schema, **and the login role** — the
  role survives a `DROP DATABASE`, and PUBLIC has CONNECT by default, so the leftover is the one that can
  still log in. Verify *after* the drop; before it, a stale connection succeeds silently.
- **A migration is proven by exact `count(*)` per table**, never `n_live_tup` — an estimate must not be
  the proof that a migration was lossless. Take a `pg_dump` first and verify the archive
  (`gzip -t`).

---

## §5 · Testing and verification

- **The suite ships INSIDE the project it tests** — `test/{unit,checks,pipeline,ui,maintenance}` with
  its own `package.json`. Cross-project tooling stays in a separate `DevTools/`-style folder.
- **One command, real exit code:** `node pipeline/test-all.mjs` runs unit + every check. Tiers are
  flags (`--full` adds GPU/model-backed checks, `--ui` adds browser drives) so the default tier stays
  cheap enough to run constantly.
- **Fail fast on preconditions.** If the server isn't answering, the suite says so and stops — *"a suite
  that cannot reach the server reports ITS failure, not the product's."*
- ⚠️ **A green log line and a zero exit are not the same thing.** And a check can **pass and still exit
  non-zero** (a libuv teardown race under `spawnSync`); `process.exitCode = ok ? 0 : 1` is the fix, but
  applied per-check, not as a sweep — a check that deliberately holds a handle open would then hang,
  turning a rare false red into a permanent stall.
- ⚠️ **A killed run poisons the next one.** Checks that clean up at the END leave fixtures behind when
  interrupted, and the next run blames the product. **Before believing a setup-state failure, check
  whether the last run died.**
- **Test as a dedicated dev user** (`agent_dev`), never as the owner's account, and leave no artifacts
  on his rows. ⛔ Root/owner is **his** account on every service — create the dev user before the first
  test turn on a new one.
- **In a test, ask the SERVER for identity**, never a literal username or a value's shape — the owner's
  username is config and can be anything.
- ⚠️ **An assertion that passes pre-fix proves nothing.** Run a new test against the OLD code first.
- ⚠️ **The INSTRUMENT lies before the subject does.** A uniformly-empty column is a broken tool, not a
  finding. A circular baseline (a judge scored against clips one of the candidates generated) measures
  nothing. Read the traceback instead of guessing the fix.
- ⚠️ **One observation is not a state.** A single `/health` 200 said "restarted" for a process that never
  died. Poll, or verify the thing you actually changed.
- **Measure before theorising** — one query settled a bug that had been wrongly diagnosed three times.
- **Report CV + N, never max−min as a "spread"** (range only grows with N), and name the perceptual or
  practical threshold before calling a difference real.
- **Nightly watchman:** a scheduled health suite at a fixed hour, on a **config-level** enable flag,
  which restores any global setting a check flipped and logs when it had to. Overlap between scheduled
  jobs is **load-bearing spacing, not politeness** — one job reading settings another is mid-flip is the
  bug it prevents.
- **UI changes:** run the browser drives **HEADED** so he can watch, inspect the screenshots before
  shipping, theme tokens only, and check both themes.

---

## §6 · Working with Ote — the protocol

- ⭐ **When he is FRAMING a phase, the deliverable is a PLAN.** No files, no provider chosen, no setting
  flipped. *"A statement about method ('small first, as a POC') is not scope approval"*, and announcing
  a cost is not the same as asking. Ask, then build.
- ⭐ **He owns the running processes.** Long-lived services he runs himself (`:8201`, Ollama) are never
  started or killed by an agent — ask if one seems down. An agent may run **its own** instance to test,
  **announced**, and stop it when done.
- ⭐ **Announce heavy runs BEFORE starting** — it is a shared workstation, and his testing usually wins.
  Stream long runs live rather than detaching blind; never start a detached run without capturing stdout.
- ⭐ **Numbers rank and screen; his EAR/EYE decides.** Measurement produces *candidates*, and nothing is
  "the winner" until he has heard or seen it. Only he closes a candidate. Same rule for two AIs agreeing
  — **that is not evidence**; he is the final veto.
- ⭐ **Data-driven comparisons, with honesty about provenance:** measure every axis that can be measured,
  one shared harness every candidate reports into, and **every cell tagged `verified` / `claimed` /
  `na`** — a spec sheet and a measurement never share an untagged column.
- ⭐ **Report the OUTCOME, not the request** — the most-repeated agent defect in this workspace. Say what
  happened, and name what failure would have looked like. *"I ran X"* is not a result.
- ⭐ **Protect his interrupts.** His best interventions are four words (*"wait"*, *"really?"*) and have a
  near-perfect hit rate. Never make a pause cost a paragraph.
- ⭐ **Never derive a person-attribute from a name.** Cite what he said, or write *unknown*. When caught,
  delete the claim rather than defending it.
- ⭐ **Escalate value calls, not method calls.** Empirical by default: test and decide. Bring him the
  choices that are actually his.
- ⭐ **Deliver in the terminal or a repo file.** He cannot open published/hosted artifact links.
- **He works on Windows first.** Linux-only tooling is real friction; prefer Windows-native, and keep
  batch/PowerShell paths working.

---

## §8 · New-project checklist *(v2 — the wizard does most of it)*

1. Clone `OteFullStackTemplate_Fastify_React`. **First commit = the pristine template**, so every
   project-specific change reads as a diff against it.
2. Run the **wizard**: name/slug, an allocated port (not 3000, not the template's 8080), database, auth,
   realtime, **remove the demo now if you don't want it** (before the first migrate), launchers, install,
   migrate. It prints the OteServerManager registration.
3. `.gitignore` / `.gitattributes` ship ready (`eol=lf`, `*.bat eol=crlf`; lockfiles, config.json,
   logs ignored). Never track `package-lock.json` or `node_modules/`.
4. Schema via **SQL migration** (`Backend/database/migrations/NNN_*.sql`), applied by `npm run db:migrate`
   as the app role; models mirror it; the server refuses to boot with pending migrations. Prefix tables
   `mst_`/`txn_`/`log_`, one name end to end (a unit test enforces it).
5. `config.json` + `config.example.json` with nested groups. No `.env`.
6. `AI_CarryOn.md`: replace the template's START HERE with the real one, write the port in it;
   `AI_ProgressTracking.md` entry #1 with a real-clock timestamp. Both **tracked**.
7. `test/` is already inside the project: `cd test && npm run test-all` — one command, real exit code. Add a
   `test/test.config.json` for the DB checks; create the `agent_dev`-equivalent user before the first test turn.
8. Register the app in OteServerManager with the values the wizard printed.

---

*Housekeeping: this doc is DESCRIPTIVE. When a convention changes, change it here in the same commit —
a standards doc that lags the practice is worse than none.*
