# MOVIE VIBES

## Tech Stack

- Remix
- Drizzle ORM / Postgres

## Getting Stared

Install dependencies

```bash
pnpm install
```

Run `cp .env.sample .env`

Migrate your DB

```bash
pnpm db:migrate
```

After changing `app/db/schema.ts`, create a migration with `pnpm db:generate` and commit the new files in `drizzle/`.

Run the server

```
pnpm run dev
```

## Changing the shared password

Generate a bcrypt hash for your new password:

```bash
node -e "import('bcryptjs').then(m => m.hash('YOUR_PASSWORD', 12).then(console.log))"
```

Copy the printed hash and set it as `AUTH_PASSWORD_HASH` in your `.env` and in your production environment. The same hash works in both places — generate it once, use it everywhere.

To generate a new `SESSION_SECRET`:

```bash
openssl rand -base64 32
```
