# Spec: Discord `/add-movie` Command

**Status:** Draft — ready for implementation
**Owner:** _(you)_
**Target:** Private/test Discord server first, then optionally the real server

---

## 1. Summary

Let members add a movie to Movie Vibes directly from Discord using a slash command:

```
/add-movie The Last Dragon
```

Discord sends the command to the Movie Vibes server, which looks the title up on
TMDB, saves it to the database using the existing movie model, and replies with a
confirmation message in Discord.

## 2. Goals

- Add a movie via a single Discord slash command (`/add-movie <title>`).
- Reuse the existing database + TMDB code paths — do **not** duplicate movie logic.
- Confirm to the user, in Discord, that the movie was added (or explain why not).
- Test safely on a private Discord server without affecting the real chat.
- No new long-running service and no meaningful added hosting cost (runs inside the existing Railway deployment).

## 3. Non-Goals (v1)

- No editing, deleting, or listing movies from Discord.
- No fuzzy disambiguation UI (auto-pick the best TMDB result; see §8).
- No support for User-Install / DMs / group DMs in v1 (see §11).
- No per-user Movie Vibes accounts — Discord identity is only used for `selectedBy` and authorization.

---

## 4. Background / Decisions already made

- **Direction:** This is **not** an incoming channel webhook. Discord **Applications** deliver command invocations ("interactions") to an HTTP endpoint we host. The endpoint lives in this repo as a React Router resource route.
- **Deployment:** Existing React Router (SSR) app on Railway. The interaction endpoint is just another route → **no separate service, no extra compute**. Discord only calls it when a command is run.
- **Isolation:** A private Guild Install on a test server. Guild commands register instantly (global commands can take up to ~1 hour to propagate), so we use guild commands for testing.

---

## 5. Architecture

```
Discord user
   │  /add-movie The Last Dragon
   ▼
Discord (Application)
   │  POST (signed interaction, JSON)
   ▼
https://<railway-domain>/api/discord/interactions   ← new resource route in this app
   │  1. verify Ed25519 signature
   │  2. authorize invoker
   │  3. searchMovie(title)            (services/tmdb.ts — existing)
   │  4. saveToDB(...) / createMovie() (app/models/movie.server.ts — existing)
   ▼
Response: confirmation message shown in Discord
```

### Components to build

1. **Resource route** — `app/routes/api.discord.interactions.ts`
   - Export `action` (POST only). No default component, no `requireLogin`.
   - Read the **raw body** (`await request.text()`) for signature verification.
2. **Discord verification util** — `app/utils/discord.server.ts`
   - `verifyDiscordRequest(request, rawBody, publicKey)` → boolean.
   - `interactionResponse(...)` helpers for PONG / message / deferred.
3. **Command registration script** — `scripts/register-discord-commands.ts`
   - Idempotent `PUT` of the guild command definition (see §6).
4. **Route registration** — add the route to `app/routes.ts`.

---

## 6. Discord command definition

- **Application/bot display name:** `Movie-Bot` (set in the Discord Developer Portal; command responses appear under this name).
- **Install:** Guild Install only for v1, on the private test server.

Register with:

```
PUT https://discord.com/api/v10/applications/{DISCORD_APPLICATION_ID}/guilds/{DISCORD_GUILD_ID}/commands
Authorization: Bot {DISCORD_BOT_TOKEN}
Content-Type: application/json
```

Body:

```json
{
  "name": "add-movie",
  "description": "Add a movie to Movie Vibes",
  "options": [
    {
      "name": "title",
      "description": "Movie title to add",
      "type": 3,
      "required": true
    },
    {
      "name": "picked-by",
      "description": "Who is picking this movie (defaults to your Discord name)",
      "type": 3,
      "required": false
    }
  ]
}
```

- `type: 3` = `STRING`.
- Keep it to `title` (required) plus optional `picked-by`. Category/status are intentionally omitted in v1 (see §7).

---

## 7. Data mapping

The interaction handler must produce exactly what the existing persistence functions need.

| Movie field   | Source                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| `movieName`   | `title` option (or the matched TMDB result's `title`)                  |
| `releaseDate` | Year from TMDB result's `release_date` → `"YYYY"` (schema stores year only) |
| `imageUrl`    | TMDB `poster_path` (already full URL via `withImageUrl` in `services/tmdb.ts`) |
| `tmdbId`      | TMDB result `id`                                                       |
| `selectedBy`  | `picked-by` option if provided, else invoker's Discord display name    |
| `status`      | Defaults to `NOT_WATCHED`                                              |
| `category`    | Defaults to `""` (empty) — matches existing `saveToDB` behavior        |

**Preferred persistence call:** `saveToDB({ movieName, releaseDate, imageUrl, tmdbId, selectedBy })`
in `app/models/movie.server.ts`, because it already implements the "minimal record, fill in later"
pattern (`status: NOT_WATCHED`, empty category). Only use `createMovie` if v1 is extended to accept
category/status options.

**Invoker display name:** `interaction.member?.user?.global_name ?? interaction.member?.user?.username ?? interaction.user?.global_name ?? interaction.user?.username` (guild vs DM shapes differ). Fall back to `"Discord"` if absent.

### 7a. Duplicate check

Before inserting, check for an existing movie with the same `tmdbId`:

- Add a helper to `app/models/movie.server.ts`, e.g.
  `findMovieByTmdbId(tmdbId: number)` → `db.movie.findFirst({ where: { tmdbId } })`.
- If a match exists, skip the insert and reply ephemeral: `This movie already exists.`
- This is why the matched TMDB result must be resolved **before** persistence — the dedupe keys on `tmdbId`, not the raw typed title.

---

## 8. Interaction handling

The endpoint receives a JSON interaction with a `type` field.

| `type` | Meaning               | Response |
| ------ | --------------------- | -------- |
| `1`    | `PING` (health check) | `{ "type": 1 }` (PONG) — required for Discord to accept the endpoint URL |
| `2`    | `APPLICATION_COMMAND` | Process command (below) |

Command handling order:

1. **Verify signature** (§9). If invalid → respond `401`, do nothing.
2. **PING** → PONG, return.
3. **Authorize** the invoker/guild (§9). If not allowed → respond with a private/ephemeral message (flags `64`) saying the command isn't available.
4. Extract `title`; call `searchMovie(title)`.
5. **No results** → ephemeral reply: `Couldn't find a movie matching "<title>".`
6. **Results** → take the **first result** (best match; `searchMovie` returns TMDB relevance order).
7. **Duplicate check** → look up an existing movie by the matched `tmdbId` **before** inserting. If one already exists, do **not** write; reply ephemeral: `This movie already exists.` (§7a).
8. Build the field mapping (§7), call `saveToDB(...)`.
   - Include the matched title + year in the confirmation so the user can spot a wrong match.
9. **Success** → reply with a confirmation message (type `4`), e.g.
   `Added **The Last Dragon (1985)** to Movie Vibes — picked by @someone.`
10. **Error** (TMDB/db failure) → ephemeral reply with a short error; do not leak stack traces.

### Response visibility

All replies are **ephemeral** (`flags: 64`, only visible to the invoker). This is the most secure option: it avoids leaking data into the channel and keeps the chat clean / non-spammy. Flip to public later only if the group wants channel visibility of added movies.

### Response timing (3-second rule)

Discord requires a response within **3 seconds**. If TMDB + DB reliably finish under that (likely),
respond synchronously with type `4`. If not, or if you're unsure:

1. Immediately respond with `{ "type": 5 }` (deferred).
2. Do the work.
3. Follow up with
   `PATCH https://discord.com/api/v10/webhooks/{DISCORD_APPLICATION_ID}/{interaction.token}/messages/@original`
   with the final message body.

Pick one strategy and document it in code. For v1, prefer the **deferred (type 5) + follow-up** path
to be safe.

---

## 9. Security / authorization

- **Signature verification is mandatory.** Verify `X-Signature-Ed25519` over `X-Signature-Timestamp + rawBody` using `DISCORD_PUBLIC_KEY`. Use the `discord-interactions` package (`verifyKey`) or `@noble/ed25519`; do not hand-roll crypto. Return `401` on failure.
  - **Must use the raw request body**, not a re-serialized object.
- **This route bypasses `requireLogin`.** Access control is enforced at the Discord layer:
  - Allowlist by guild ID (the test server) and/or by Discord user ID.
  - Reject any invocation from outside the allowlist with an ephemeral message.
  - Read allowlists from env (comma-separated).
- **Secrets:** only the bot token is used at registration time; the public key is safe to keep in env too. Never log the token or full interaction payloads containing tokens.

### Environment variables (add to `.env.sample` and Railway)

```
DISCORD_APPLICATION_ID=""
DISCORD_PUBLIC_KEY=""
DISCORD_BOT_TOKEN=""            # registration script only
DISCORD_GUILD_ID=""            # test server for command registration
DISCORD_ALLOWED_GUILD_IDS=""   # comma-separated; command only works here
DISCORD_ALLOWED_USER_IDS=""    # comma-separated; optional extra lock-down
```

TMDB vars already exist: `TMDB_API_URL`, `TMDB_API_TOKEN`, `TMDB_API_IMAGE_URL`.

---

## 10. Files

**Create**

- `app/routes/api.discord.interactions.ts`
- `app/utils/discord.server.ts`
- `scripts/register-discord-commands.ts`
- `test/discord.server.test.ts` (unit tests for verify + mapping)

**Modify**

- `app/routes.ts` — add `route("api/discord/interactions", "./routes/api.discord.interactions.ts")`
- `app/models/movie.server.ts` — add `findMovieByTmdbId` helper for the duplicate check
- `.env.sample` — add Discord env vars
- `package.json` — add dependency (`discord-interactions`) and a script, e.g. `"discord:register": "tsx scripts/register-discord-commands.ts"` (match the existing script runner style used by `scripts/backfill-tmdb-ids.ts`)

---

## 11. Future / out of scope for v1

- **User Install → DMs & group DMs.** Enable by supporting both `guild` and `user` install contexts (`integration_types`) and `contexts` (`GUILD`, `BOT_DM`, `PRIVATE_CHANNEL`). This is what lets `/add-movie` work in a private group DM. Verify Discord's current support for group DMs before relying on it; not part of v1.
- Optional `category` / `status` command options.
- Disambiguation: if multiple plausible matches, present a select menu (Component/Menu) before saving.
- Slash command in the real server (register as a global command).

---

## 12. Testing

- **Unit (Vitest):**
  - Signature verification accepts a valid signature and rejects a tampered body/timestamp.
  - Command parsing → `saveToDB` payload mapping is correct (title, year extraction, poster URL, selectedBy fallback).
  - Non-allowlisted guild/user is rejected.
- **Manual (private server):**
  - Set the Interactions Endpoint URL to `https://<railway-domain>/api/discord/interactions`; Discord's "Save" performs a PING (must succeed and return PONG).
  - Run `/add-movie The Last Dragon` → verify a row in Postgres and a confirmation in Discord.
  - Run a nonsense title → verify the "not found" reply and no DB write.
  - Confirm the endpoint is unreachable without a valid signature.
- **Local dev:** Discord needs a public HTTPS URL; use a tunnel (`cloudflared`/`ngrok`) pointed at the local server, or test against a Railway preview deploy.

---

## 13. Acceptance criteria

1. `/add-movie <title>` on the test server creates a movie row with correct `movieName`, `releaseDate` (year), `imageUrl`, `tmdbId`, `selectedBy`, `status = NOT_WATCHED`.
2. Discord shows an ephemeral confirmation (from `Movie-Bot`) with the matched title/year.
3. Running the same movie again replies `This movie already exists.` and does **not** create a second row.
4. PING returns PONG so the endpoint URL saves successfully.
5. Unsigned/invalid-signature requests get `401` and no DB write.
6. Invocations from non-allowlisted guilds/users are refused.
7. No new Railway service is required; deploys with the existing app.
8. Unit tests pass; `pnpm lint` and `pnpm typecheck` pass.

---

## 14. Decisions

- **Bot display name:** `Movie-Bot`.
- **Response visibility:** all replies **ephemeral** (most secure, least spammy).
- **Duplicates:** blocked — reply `This movie already exists.` and perform no insert.
- **`picked-by`:** defaults to the invoker's Discord display name; optional override via the command option.

## 15. Open questions

- None blocking. Future: add `category`/`status` options, disambiguation menu, User Install for DMs/group DMs (see §11).
