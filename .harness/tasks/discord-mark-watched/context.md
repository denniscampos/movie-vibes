# Context pack: Discord `/mark-watched` command for upcoming movies

These are pointers for where to look. The spec is the contract. Report any entry here that turns out to be wrong.

## Change here
- app/utils/discord-commands.ts — command definitions; add `markWatchedCommand` and append to `commands`.
- app/routes/api.discord.interactions.ts — `action` (isKnownCommand ~line 202, autocomplete branch ~214, command dispatch ~231); add autocomplete + command handling, reusing `sendFollowUp`/`deferredPublic`.
- app/utils/discord.server.ts — message constants (~line 38), choice builders (`buildChoices`, `formatLabel`, MAX_CHOICES/MAX_CHOICE_LENGTH), parsers (`parseTmdbChoice`); add pure helpers for movie choices, `movie:<id>` parsing and messages.
- app/models/movie.server.ts — DB helpers (`findCategoryNames`, `pickRandomMovie`, `changeMovieStatus`); add helpers for searching UPCOMING movies and a conditional UPCOMING→WATCHED update (e.g. `updateMany` where `{ id, status: UPCOMING }`).
- scripts/register-discord-commands.ts — header comment lists command names.

## Callers
- app/routes/home.tsx:16 — loader uses `fetchUpcomingMovies` (status UPCOMING only); unchanged.
- scripts/register-discord-commands.ts — PUTs `commands`.

## Tests
- test/discord-category-random.test.ts — pattern: mocks `~/models/movie.server` and `../services/tmdb` via `vi.hoisted`, signs requests with an ed25519 keypair, sets env `DISCORD_PUBLIC_KEY`, `DISCORD_ALLOWED_GUILD_IDS`, stubs `fetch` for follow-ups.
- test/discord-dm.test.ts:170 — asserts `commands` equals `[addMovieCommand, randomMovieCommand]`; must be updated to include the new command.
- Other Discord tests mock `~/models/movie.server` with only the functions they use; new model functions imported by the route must not break them (vi.mock factories missing an export make the import `undefined`, which is fine unless called).
- New test files: writer → test/discord-mark-watched.test.ts; test-designer → test/discord-mark-watched-adversarial.test.ts.

## Conventions
- Lint is oxlint with `--deny-warnings`; typecheck runs `prisma generate && react-router typegen && tsc`.
- Never log the interaction token, URL or payload; log only `error.message`.
- `MovieStatus` is imported from `~/lib/generated/prisma/enums`.
- Vitest is the test runner (`pnpm test run`); tests live in `test/`.
