# Closeout: Discord `/mark-watched` command for upcoming movies

- Outcome: clean
- Review rounds: 1, repair rounds: 0
- Approved fingerprint: 9b195f9b242a9749
- Branch / worktree: hh/discord-mark-watched at /Users/dennis/Developer/movie-vibes.worktrees/discord-mark-watched

## What changed
New `/mark-watched` slash command with a required, autocompleting `movie` option. Autocomplete lists only UPCOMING movies (`movie:<id>` values). Submitting a pick, or an exact case-insensitive name, sets that movie from UPCOMING to WATCHED with a single conditional `updateMany` on `{ id, status: UPCOMING }` that writes only `status`. The movie then drops off the home page's Upcoming queue. Replies: a public `✅ Marked **Title (Year)** as watched.`, or ephemeral messages for empty input, no match, an ambiguous name, or a DB error.
- app/utils/discord-commands.ts: `markWatchedCommand`, appended to `commands`
- app/routes/api.discord.interactions.ts: autocomplete and command handling (same allowlist, same deferred flow)
- app/utils/discord.server.ts: message constants, `parseMovieChoice`, `formatMovieLabel`, `buildMovieChoices`, `buildMarkedWatchedMessage`
- app/models/movie.server.ts: `findUpcomingMovies`, `findUpcomingMoviesByName`, `markUpcomingMovieWatched`
- scripts/register-discord-commands.ts: header comment
- test/discord-dm.test.ts: `commands` assertion now includes the new command
- Tests: 43 added across the suite (164 at the approved candidate vs 121 at base): test/discord-mark-watched.test.ts (19) and test/discord-mark-watched-adversarial.test.ts (24). Curation was discarded. `curate --end` flagged vitest's own result cache (`node_modules/.vite/vitest/.../results.json`, rewritten by any test run) as an out-of-scope change. Both designated files were written back to their pre-curation content (curation discarded for each), so both test files remain.

## Review record
- Round 1: homework-harness:reviewer gave 0 claims. opencode-go:glm-5.3 and opencode-go:kimi-k3 both failed with "Upstream request failed: Invalid credential" and contributed nothing. 0 reproduced, 0 refuted, 0 unadjudicated.
- Before review, round 1 checks failed typecheck (TS2339 in the adversarial test's in-memory db fake). A fresh writer fixed the fake's types without touching assertions, and the full checks then passed.

## Deferred or dismissed findings
none

## Not verified
- Not run against a real Postgres database or Discord. Every test mocks either `~/models/movie.server` or `~/db.server`, so the Prisma queries (`mode: "insensitive"` equals/contains, conditional `updateMany`) are checked only for their arguments, not executed.
- Unconfirmed, and not raised as a finding: Prisma's case-insensitive `equals` may compile to `ILIKE` without escaping `%`/`_`. If so, free text such as `%` could match a single upcoming movie and mark it watched. With 2 or more matches the reply is "ambiguous" and nothing changes. `findCategoryNames` already uses the same pattern.
- The command must be registered with `pnpm discord:register` before it appears in Discord. That was not run.
- External review seats did not run (invalid OpenCode Go credential), so this was a Claude-only review.

## Context pack
Used (context.md). No agent reported a wrong entry.
