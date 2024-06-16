# MOVIE VIBES

## Tech Stack

- Remix
- Prisma / Postgres

## Getting Stared

Install dependencies

```bash
npm install
```

Create an `.env` file and add the following environment variables.

```typescript
DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/movie_vibes?schema=public";
TMDB_API_URL = "https://api.themoviedb.org/3";
TMDB_API_TOKEN = "";
TMDB_API_IMAGE_URL = "https://image.tmdb.org/t/p/w1280";
```

Generate and migrate your DB

```bash
npx prisma migrate dev && npx prisma generate
```

Run the server

```
npm run dev
```
