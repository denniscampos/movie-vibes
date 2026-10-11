import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  ne,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import db from "~/db.server";
import { category, movie, MovieStatus } from "~/db/schema";
import { uniquePickerNames } from "~/utils/pickers";

/** `column` contains `value`, ignoring case; LIKE wildcards in `value` match literally. */
const containsInsensitive = (column: AnyPgColumn, value: string) =>
  ilike(column, `%${value.replace(/[\\%_]/g, "\\$&")}%`);

/** `column` equals `value`, ignoring case. */
const equalsInsensitive = (column: AnyPgColumn, value: string) =>
  eq(sql`lower(${column})`, sql`lower(${value})`);

export const fetchMovies = async (searchQuery?: string) => {
  return db
    .select({
      id: movie.id,
      movieName: movie.movieName,
      releaseDate: movie.releaseDate,
      selectedBy: movie.selectedBy,
      status: movie.status,
      category: {
        name: category.name,
      },
    })
    .from(movie)
    .innerJoin(category, eq(movie.categoryId, category.id))
    .where(
      searchQuery === undefined
        ? undefined
        : containsInsensitive(movie.movieName, searchQuery),
    )
    .orderBy(desc(movie.createdAt));
};

export const fetchUpcomingMovies = async () => {
  return db
    .select({
      id: movie.id,
      tmdbId: movie.tmdbId,
      movieName: movie.movieName,
      releaseDate: movie.releaseDate,
      selectedBy: movie.selectedBy,
      category: {
        name: category.name,
      },
      imageUrl: movie.imageUrl,
      status: movie.status,
    })
    .from(movie)
    .innerJoin(category, eq(movie.categoryId, category.id))
    .where(eq(movie.status, MovieStatus.UPCOMING));
};

/** Inserts a movie together with its own category, atomically. */
const insertMovieWithCategory = async (
  categoryName: string,
  values: Omit<typeof movie.$inferInsert, "categoryId">,
) => {
  return db.transaction(async (tx) => {
    const [{ id: categoryId }] = await tx
      .insert(category)
      .values({ name: categoryName })
      .returning({ id: category.id });
    const [created] = await tx
      .insert(movie)
      .values({ ...values, categoryId })
      .returning();
    return created;
  });
};

export const createMovie = async ({
  movieName,
  releaseDate,
  selectedBy,
  categoryName,
  status,
  imageUrl,
  tmdbId,
}: {
  movieName: string;
  releaseDate: string;
  selectedBy: string;
  categoryName: string;
  status: MovieStatus;
  imageUrl?: string;
  tmdbId?: number;
}) => {
  return insertMovieWithCategory(categoryName, {
    movieName,
    releaseDate,
    selectedBy,
    status,
    imageUrl,
    tmdbId,
  });
};

export const changeMovieStatus = async ({
  id,
  status,
}: {
  id: string;
  status: MovieStatus;
}) => {
  if (!id) {
    throw new Error("Movie ID is required");
  }

  const [updated] = await db
    .update(movie)
    .set({ status })
    .where(eq(movie.id, id))
    .returning();
  if (!updated) throw new Error(`Movie ${id} not found`);
  return updated;
};

export const saveToDB = async ({
  movieName,
  releaseDate,
  imageUrl,
  tmdbId,
  selectedBy,
}: {
  movieName: string;
  releaseDate: string;
  imageUrl?: string;
  tmdbId?: number;
  selectedBy: string;
}) => {
  const getYear = releaseDate.split("-")[0];
  // everything except the basics stays empty since the goal is to update the movie later
  return insertMovieWithCategory("", {
    movieName,
    releaseDate: getYear,
    tmdbId,
    imageUrl,
    status: MovieStatus.NOT_WATCHED,
    selectedBy: selectedBy,
  });
};

export const updateMovie = async ({
  movieId,
  movieName,
  releaseDate,
  selectedBy,
  categoryName,
}: {
  movieId: string;
  movieName: string;
  releaseDate: string;
  selectedBy: string;
  categoryName: string;
}) => {
  if (!movieId) {
    throw new Error("Movie ID is required");
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(movie)
      .set({ movieName, releaseDate, selectedBy })
      .where(eq(movie.id, movieId))
      .returning();
    if (!updated) throw new Error(`Movie ${movieId} not found`);
    await tx
      .update(category)
      .set({ name: categoryName })
      .where(eq(category.id, updated.categoryId));
    return updated;
  });
};

export const removeMovies = async (movieIds: string[]) => {
  if (!movieIds) {
    throw new Error("Movie ID is required");
  }

  await Promise.all(
    movieIds.map(async (id) => {
      const deleted = await db
        .delete(movie)
        .where(eq(movie.id, id))
        .returning({ id: movie.id });
      if (deleted.length === 0) throw new Error(`Movie ${id} not found`);
    }),
  );
};

export const findMovieByTmdbId = async (tmdbId: number) => {
  const [found] = await db
    .select()
    .from(movie)
    .where(eq(movie.tmdbId, tmdbId))
    .limit(1);
  return found ?? null;
};

const MAX_CATEGORY_SUGGESTIONS = 25;

/**
 * Distinct, non-empty category names that are attached to a movie, matching
 * `query` (case-insensitive). `unwatchedOnly` limits to categories that still
 * have a movie left to watch.
 */
export const findCategoryNames = async (
  query: string,
  { unwatchedOnly = false }: { unwatchedOnly?: boolean } = {},
) => {
  const rows = await db
    .selectDistinct({ name: category.name })
    .from(category)
    .where(
      and(
        containsInsensitive(category.name, query),
        ne(category.name, ""),
        exists(
          db
            .select({ one: sql`1` })
            .from(movie)
            .where(
              and(
                eq(movie.categoryId, category.id),
                unwatchedOnly ? ne(movie.status, MovieStatus.WATCHED) : undefined,
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(category.name))
    .limit(100);

  // `distinct` is case-sensitive; collapse "Horror" / "horror" into one.
  const seen = new Set<string>();
  const names: string[] = [];
  for (const { name } of rows) {
    const trimmed = name.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  return names.slice(0, MAX_CATEGORY_SUGGESTIONS);
};

const MAX_UPCOMING_SUGGESTIONS = 25;

/** UPCOMING movies whose name contains `query` (case-insensitive). */
export const findUpcomingMovies = async (query: string) => {
  return db
    .select({
      id: movie.id,
      movieName: movie.movieName,
      releaseDate: movie.releaseDate,
    })
    .from(movie)
    .where(
      and(
        eq(movie.status, MovieStatus.UPCOMING),
        containsInsensitive(movie.movieName, query.trim()),
      ),
    )
    .orderBy(asc(movie.movieName))
    .limit(MAX_UPCOMING_SUGGESTIONS);
};

/** UPCOMING movies whose name equals `name` (case-insensitive); at most 2. */
export const findUpcomingMoviesByName = async (name: string) => {
  return db
    .select({
      id: movie.id,
      movieName: movie.movieName,
      releaseDate: movie.releaseDate,
    })
    .from(movie)
    .where(
      and(
        eq(movie.status, MovieStatus.UPCOMING),
        equalsInsensitive(movie.movieName, name.trim()),
      ),
    )
    .limit(2);
};

/**
 * Sets an UPCOMING movie to WATCHED. The write is conditional on the status
 * still being UPCOMING, so other movies are never changed. Returns the movie
 * label fields, or undefined when no UPCOMING movie had this id.
 */
export const markUpcomingMovieWatched = async (id: string) => {
  const [updated] = await db
    .update(movie)
    .set({ status: MovieStatus.WATCHED })
    .where(and(eq(movie.id, id), eq(movie.status, MovieStatus.UPCOMING)))
    .returning({ movieName: movie.movieName, releaseDate: movie.releaseDate });
  return updated;
};

/**
 * A random movie that hasn't been watched yet, optionally limited to a
 * category (case-insensitive exact match). Undefined when nothing qualifies.
 */
export const pickRandomMovie = async ({
  categoryName,
}: { categoryName?: string } = {}) => {
  const movies = await db
    .select({
      movieName: movie.movieName,
      releaseDate: movie.releaseDate,
      selectedBy: movie.selectedBy,
      category: { name: category.name },
    })
    .from(movie)
    .innerJoin(category, eq(movie.categoryId, category.id))
    .where(
      and(
        ne(movie.status, MovieStatus.WATCHED),
        categoryName
          ? equalsInsensitive(category.name, categoryName)
          : undefined,
      ),
    );
  if (movies.length === 0) return undefined;
  return movies[Math.floor(Math.random() * movies.length)];
};

/**
 * The /spin pick: a random name from the people with an UPCOMING movie, the
 * same set the home-page wheel spins over. Undefined when nobody qualifies.
 */
export const pickRandomUpcomingPicker = async () => {
  const movies = await db
    .select({ selectedBy: movie.selectedBy })
    .from(movie)
    .where(eq(movie.status, MovieStatus.UPCOMING));
  const names = uniquePickerNames(movies.map((m) => m.selectedBy));
  if (names.length === 0) return undefined;
  return names[Math.floor(Math.random() * names.length)];
};
