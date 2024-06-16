# MOVIE VIBES

## Tech Stack

- Remix
- Prisma / Postgres

## Getting Stared

Install dependencies

```bash
npm install
```

Run the local DB and add the `DATABASE_URL` by creating an `.env` file

```typescript
DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/movie_vibes?schema=public";
```

Generate and migrate your DB

```bash
npx prisma migrate dev && npx prisma generate
```

Run the server

```
npm run dev
```
