/**
 * One-off: backfill `tmdbId` on existing Movie rows by re-querying TMDB.
 *
 * Usage:
 *   pnpm tsx --env-file=.env scripts/backfill-tmdb-ids.ts             # dry run (default)
 *   pnpm tsx --env-file=.env scripts/backfill-tmdb-ids.ts --apply     # write updates
 *
 * Requires DATABASE_URL + TMDB_API_URL + TMDB_API_TOKEN in env.
 *
 * Matching strategy (first hit wins):
 *   1. Exact poster URL match against TMDB search results
 *   2. Title (case-insensitive) + release year match
 *
 * Unmatched rows are logged for manual review; they are left untouched.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/lib/generated/prisma/client";
import { searchMovie } from "../services/tmdb";

type SearchResult = Awaited<ReturnType<typeof searchMovie>>[number];

const SLEEP_MS = 100; // be polite to TMDB (~10 req/s)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function yearOf(dateish: string | null | undefined): string | null {
  if (!dateish) return null;
  // Stored as "1984" in some rows, ISO "1984-11-14" in others.
  if (/^\d{4}$/.test(dateish)) return dateish;
  const d = new Date(dateish);
  if (isNaN(d.getTime())) return null;
  return String(d.getFullYear());
}

function pickMatch(
  results: SearchResult[],
  row: { movieName: string; releaseDate: string; imageUrl: string | null },
): SearchResult | null {
  // 1. exact poster URL
  if (row.imageUrl) {
    const byPoster = results.find((r) => r.poster_path === row.imageUrl);
    if (byPoster) return byPoster;
  }
  // 2. title + year
  const wantYear = yearOf(row.releaseDate);
  const wantTitle = normalize(row.movieName);
  const byTitleYear = results.find(
    (r) =>
      normalize(r.title) === wantTitle &&
      yearOf(r.release_date) === wantYear,
  );
  return byTitleYear ?? null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const db = new PrismaClient({ adapter });

  try {
    // `tmdbId` doesn't exist until the migration lands — cast to any until then.
    const rows: Array<{
      id: string;
      movieName: string;
      releaseDate: string;
      imageUrl: string | null;
      tmdbId: number | null;
    }> = await (db.movie as any).findMany({
      where: { tmdbId: null },
      select: {
        id: true,
        movieName: true,
        releaseDate: true,
        imageUrl: true,
        tmdbId: true,
      },
    });

    console.log(
      `[backfill] mode=${apply ? "APPLY" : "dry-run"} · candidates=${rows.length}`,
    );

    let matched = 0;
    let updated = 0;
    const unmatched: Array<{ id: string; title: string; year: string | null }> = [];

    for (const row of rows) {
      const results = (await searchMovie(row.movieName)) as SearchResult[];
      const match = pickMatch(results, row);

      if (match) {
        matched += 1;
        console.log(
          `  ✓ ${row.movieName} (${yearOf(row.releaseDate) ?? "?"})  →  tmdbId=${match.id}`,
        );
        if (apply) {
          await (db.movie as any).update({
            where: { id: row.id },
            data: { tmdbId: match.id },
          });
          updated += 1;
        }
      } else {
        unmatched.push({
          id: row.id,
          title: row.movieName,
          year: yearOf(row.releaseDate),
        });
        console.log(
          `  ✗ ${row.movieName} (${yearOf(row.releaseDate) ?? "?"})  —  no confident match`,
        );
      }

      await sleep(SLEEP_MS);
    }

    console.log("");
    console.log(`[backfill] matched=${matched}/${rows.length}  updated=${updated}`);
    if (unmatched.length > 0) {
      console.log(`[backfill] unmatched rows (review manually):`);
      for (const u of unmatched) {
        console.log(`  - ${u.id}  "${u.title}" (${u.year ?? "?"})`);
      }
    }
    if (!apply && matched > 0) {
      console.log("\n[backfill] dry run — re-run with --apply to write these updates.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});
