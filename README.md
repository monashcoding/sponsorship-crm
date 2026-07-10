# MAC Sponsorship CRM

Internal, committee-wide tool for the MAC sponsorship team to track company outreach —
companies, contacts, every touchpoint, follow-ups, and pipeline stage. It replaces the
spreadsheet where leads go cold, and is **institutional memory the next committee inherits**:
audit trails and clean handover are first-class.

- **Live:** https://crm.monashcoding.com
- **Auth:** MAC Suite (`auth.monashcoding.com`) — access gated on the `committee` role.

## Access model

Every committee member gets full CRUD. The single gate is `claims.roles.includes("committee")`.
There are no admin tiers and no PII masking inside the app — `created_by` / `owner` / `changed_by`
are **institutional memory, not access control**. A signed-in non-committee user gets a clean 403
screen.

## Architecture

| Piece | Choice |
|---|---|
| Runtime | Node 22 · TypeScript (ESM) |
| API | Express, mounted under `/api` |
| ORM / DB | Drizzle · its **own** Postgres 16 (never shared) |
| Frontend | React + Vite, served as static files by the same container |
| Deploy | Dokploy Compose behind Traefik (TLS via Let's Encrypt) |

**One container serves both API and SPA**, so the app is same-origin (no CORS for app calls). The
only cross-origin call is the frontend → `auth.monashcoding.com` for a token, which Better Auth
permits automatically for any `*.monashcoding.com` subdomain — **no auth-side change is needed to
onboard this app.**

Everything mutable is a projection over an append-only log: `companies.stage` is the fast render
value with every change in `stage_history`; a touchpoint's current status is the latest row in
`touchpoint_events`. Rollups (has-reply, overdue) are computed on read — nothing to invalidate.

## Local development

Prereqs: Node 22, a local Postgres 16 (with the `pg_trgm` extension available).

```bash
cp .env.example .env          # then edit DATABASE_URL to your local Postgres
npm install
npm run db:generate           # generate SQL migrations from src/db/schema.ts (already committed)
npm run db:migrate            # creates pg_trgm + applies migrations

# two terminals:
npm run dev                   # API on :3000 (does NOT migrate — run db:migrate first)
npm run dev:web               # Vite dev server on :5173, proxying /api → :3000
```

Migrations run as a **separate process** before the server (as in mac-auth): locally via
`npm run db:migrate`; in the container the CMD is `node dist/db/migrate.js && node dist/index.js`.

Open http://localhost:5173. Sign-in still goes to the real `auth.monashcoding.com`; set
`VITE_AUTH_URL` in `web/.env` if you point at a different auth instance.

Useful scripts: `npm run typecheck`, `npm run build` (builds SPA then server), `npm start`.

## Auth integration (MAC Suite recipe)

- `src/verify.ts` is copied from mac-auth's `examples/verify.ts` (only dep: `jose`). It verifies
  `iss`/`aud`/`exp` against mac-auth's JWKS. **If mac-auth changes its claim shape, re-copy its
  `examples/verify.ts` over this file.**
- **Token contract:** `{ macUserId, email, roles, team, ver }`. Data is keyed by the stable
  `macUserId` (never email). The committee gate is `roles.includes("committee")`.
- **`name` is not in the token yet.** The spec depends on a mac-auth roster/claims extension
  (`SPEC_roster_and_claims.md`) that adds a `name` claim; until it ships, `verify.ts` reads `name`
  forward-compatibly (it's `undefined` today) and every display falls back to `email`. The
  `crm_member.name` column and `/api/me`'s `name` field light up automatically when auth ships it —
  no code change here.
- Frontend holds the token **in memory only** (never localStorage); `src/lib/apiFetch.ts` refetches
  once on a 401 and retries (tokens live ~15 min).
- `requireCommittee` gates the entire `/api` router; `/health` is ungated.

> **Transient 403:** mac-auth falls back to base roles if the roster read fails at mint, so a real
> committee member can momentarily lack `committee` during a Notion/roster blip. Tokens are 15 min
> so it self-heals; the 403 body advises a re-login rather than reading as a bug.

## Deploy (Dokploy)

Compose stack in `docker-compose.dokploy.yml` (mirrors mac-auth): `app` (build from `./`, applies
migrations then serves SPA + API on `:3000`), `postgres` (own DB, healthchecked), `backup`
(`backup/backup.sh` — nightly `pg_dump` with rotation). No host ports and **no hand-written Traefik
labels**: deploy as a Dokploy "Compose" service, then add the domain (`crm.monashcoding.com`,
container port 3000, HTTPS/Let's Encrypt) in Dokploy's **Domains tab** — Dokploy writes the labels.
Set `POSTGRES_USER/PASSWORD/DB` and `BACKUP_KEEP_DAYS` in Dokploy's env.

**Redeploy = push to `main`, then Deploy in Dokploy.**

## Tags

Free-form labels the committee defines and applies to companies — e.g. `Sponsors 2026`,
`Networking Night` — so the pipeline can be filtered to a cohort. Tags are reusable
(many-to-many via `company_tags`), deduped case/whitespace-insensitively, and each gets an
auto-assigned colour from a fixed palette.

- **Apply / remove:** company detail page → Tags section (type to autocomplete an existing tag or
  create a new one on the fly).
- **Filter:** the chip bar on the Pipeline page filters the board/table to one tag.
- **API:** `GET/POST /api/tags`, `DELETE /api/tags/:id`, `POST /api/companies/:id/tags`
  (`{tagId}` or `{name}`), `DELETE /api/companies/:id/tags/:tagId`; `GET /api/companies?tag=<id>`
  and `GET /api/pipeline?tag=<id>` filter by tag.

Tags are embedded in the company list/detail payloads (`tags: [{id,name,color}]`), aggregated in
the same query — no extra round-trip.

## Gmail reply detection

Automatically flips a touchpoint to `replied` (or `bounced`) when a sponsor answers — no manual
status update. Inbound mail is matched to a contact's email and fed through the *same*
`recordTouchpointStatus` choke point as manual updates, tagged `source:"gmail"`. The poller only
**reads** mail (`gmail.readonly`), and stores header facts (who replied), never message bodies.

**How it fits together**

| Piece | File |
|---|---|
| Mailbox registry (add recruitment@/events@ here) | `src/gmail/mailboxes.ts` |
| OAuth2 + refresh-token client | `src/gmail/client.ts` |
| Detector (poll → classify → match) | `src/gmail/replyDetector.ts` |
| Incremental cursor per mailbox | `gmail_sync_state` table + `src/gmail/syncState.ts` |
| Cron entrypoint | `src/jobs/gmailSync.ts` (`npm run gmail:sync`) |
| One-time token minting | `scripts/gmail-oauth.ts` (`npm run gmail:auth`) |

**One-time setup**

1. Google Cloud Console → new project → enable **Gmail API**.
2. OAuth consent screen → **Internal** (monashcoding.com is Workspace, so no verification and the
   refresh token never expires). Add scope `.../auth/gmail.readonly`.
3. Credentials → OAuth client ID → **Desktop app**. Put the client id/secret in the app env as
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. `npm run gmail:auth`, **sign in as sponsorship@monashcoding.com** (not a personal account), and
   copy the printed token into `GMAIL_SPONSORSHIP_REFRESH_TOKEN`.
5. Schedule `npm run gmail:sync` (or `node dist/jobs/gmailSync.js`) every ~10 min via the Dokploy
   scheduler / cron. With nothing configured it exits 0 as a no-op, so it's safe to wire up first.

Onboarding `recruitment@` / `events@` later = uncomment the row in `mailboxes.ts` + run
`gmail:auth` signed in as that inbox + set its refresh-token env var. No code changes.

> **Matching caveat (v1):** a reply is attached to the contact's most recent still-open email
> touchpoint (idempotent — it won't double-record). Precise thread matching lands when outbound
> auto-logging stores a Gmail `threadId` on the touchpoint.

## Deferred (not built)

- Outbound auto-logging — create a touchpoint when a committee member emails a sponsor (would also
  enable thread-level reply matching above).
- AI outreach email generator — Phase 2.
- Sponsorship-tier templates, deal-value dashboard, Discord follow-up pings, contract attachments.

## Handover checklist

- [ ] App served on `crm.monashcoding.com` (auto-trusted by auth; no auth-side change needed).
- [ ] `src/verify.ts` reconciled with mac-auth's `examples/verify.ts`; `AUTH_URL` / `JWT_ISSUER` /
      `JWT_AUDIENCE` set.
- [ ] Own Postgres + nightly backups verified; **test a restore**.
- [ ] Access to Dokploy, the Oracle VM, and the `projects@` password manager (DB password lives
      there).
- [ ] Confirm committee login works and a `member`-only user gets the 403 screen.
- [ ] Know the reassignment flow (Reassign tab) for end-of-year handover: transfer the outgoing
      sponsorship lead's whole book to the incoming one.
- [ ] Redeploy = push to `main`, Deploy in Dokploy.
