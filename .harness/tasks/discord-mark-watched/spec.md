# Discord `/mark-watched` command for upcoming movies
Commit: Discord: `/mark-watched` moves an upcoming movie to watched

## Outcome
A new Discord slash command `/mark-watched` lets an allowed user pick a movie whose status is UPCOMING and set its status to WATCHED, so it drops out of the home page's "Upcoming queue" (which lists only UPCOMING movies).

## Acceptance criteria
- `app/utils/discord-commands.ts` exports `markWatchedCommand` with `name: "mark-watched"`, a description, the same `integration_types` and `contexts` as the other commands, and one option: `name: "movie"`, `type: 3`, `required: true`, `autocomplete: true`. `commands` is `[addMovieCommand, randomMovieCommand, markWatchedCommand]`, in that order. The module stays free of server-only, database and network imports.
- The interactions route treats `mark-watched` as a known command: it goes through the same signature check and the same `isInvocationAllowed` allowlist as `/add-movie` and `/random-movie` (refused invocations get the existing `MSG_NOT_AVAILABLE` ephemeral reply; refused autocomplete gets an empty choice list).
- Autocomplete for the focused `movie` option returns choices built only from movies whose status is UPCOMING and whose name contains the typed text (case-insensitive, trimmed; an empty query lists upcoming movies). At most 25 choices; each choice `name` is the movie label ("Title (Year)", or just the title when the year is empty) truncated to at most 100 characters, and each `value` identifies the movie by its database id as `movie:<id>` (at most 100 characters). A database error during autocomplete returns an empty choice list and is logged without the interaction payload.
- On the command, an empty/whitespace `movie` value gets an immediate ephemeral reply asking for a movie (a new message constant), without deferring.
- Otherwise the command uses the existing deferred flow (public deferred reply, then PATCH on success, or DELETE + ephemeral follow-up on failure), and resolves the target:
  - a value of the form `movie:<id>` targets that movie id;
  - any other text targets the UPCOMING movie whose name equals the text, compared case-insensitively after trimming; if more than one UPCOMING movie matches, the reply is an ephemeral message asking the user to pick from the suggestions, and nothing changes.
- The status change is conditional: a movie is set to WATCHED only if its status is UPCOMING at the moment of the update (a single conditional database write, so a movie that is NOT_WATCHED, already WATCHED, or deleted is never changed). Only `status` is written; name, release date, picker, category, image and tmdbId are untouched.
- On success the public message names the movie, e.g. `✅ Marked **Inception (2010)** as watched.` (label without the year when the year is empty).
- When no UPCOMING movie matches (unknown id, a movie that is not UPCOMING, or no name match), the reply is an ephemeral message saying no upcoming movie matched and suggesting picking from the suggestions; nothing changes.
- A database error during the command yields an ephemeral generic error message (a new constant), logged with the error message only (never the token or payload).
- `/add-movie` and `/random-movie` behave exactly as before, including their autocomplete.
- The registration script's header comment mentions the new command.
- New tests cover the command definition, autocomplete, each resolution path, the conditional update, the success/not-found/ambiguous/error replies, and the allowlist.

## Out of scope
- No UI changes: the home page already lists only UPCOMING movies via `fetchUpcomingMovies`.
- No Prisma schema or migration changes.
- No other status transitions (e.g. marking NOT_WATCHED movies watched, or un-watching) from Discord.
- `docs/specs/discord-add-movie.md` is left unchanged.
- No changes to the web app's existing status-change action (`changeMovieStatus`).

## Checks
Success condition: every command below exits 0. Regression check: the existing Discord test files (`test/discord*.test.ts`) keep passing, including `test/discord-dm.test.ts`'s `commands` list assertion updated only to include the new command.

Targeted:
pnpm exec vitest run test/discord
pnpm lint

Full:
pnpm lint
DATABASE_URL=postgresql://fake:fake@localhost:5432/fake pnpm typecheck
pnpm test run
