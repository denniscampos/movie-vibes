# MOVIE VIBES

## Tech Stack

- Remix
- Prisma / Postgres

## Getting Stared

Install dependencies

```bash
pnpm install
```

Run `cp .env.sample .env`

Generate and migrate your DB

```bash
pnpm exec prisma migrate dev && pnpm exec prisma generate
```

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
