import db from "~/db.server";
import { MovieStatus } from "~/lib/generated/prisma/enums";

export const fetchMovies = async (searchQuery?: string) => {
  const movie = await db.movie.findMany({
    where: {
      movieName: {
        contains: searchQuery,
        mode: "insensitive",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      movieName: true,
      releaseDate: true,
      selectedBy: true,
      status: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  return movie;
};

export const fetchUpcomingMovies = async () => {
  const upcomingMovies = await db.movie.findMany({
    where: {
      status: MovieStatus.UPCOMING,
    },
    select: {
      id: true,
      tmdbId: true,
      movieName: true,
      releaseDate: true,
      selectedBy: true,
      category: {
        select: {
          name: true,
        },
      },
      imageUrl: true,
      status: true,
    },
  });

  return upcomingMovies;
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
  return db.movie.create({
    data: {
      category: {
        create: {
          name: categoryName,
        },
      },
      movieName,
      releaseDate,
      selectedBy,
      status,
      imageUrl,
      tmdbId,
    },
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

  return db.movie.update({
    where: {
      id,
    },
    data: {
      status,
    },
  });
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
  return db.movie.create({
    data: {
      movieName,
      releaseDate: getYear,
      tmdbId,
      // everything below will be empty since the goal is to update the movie later
      category: {
        create: {
          name: "",
        },
      },
      imageUrl,
      status: MovieStatus.NOT_WATCHED,
      selectedBy: selectedBy,
    },
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

  return await db.movie.update({
    where: {
      id: movieId,
    },
    data: {
      movieName,
      releaseDate,
      selectedBy,
      category: {
        update: {
          name: categoryName,
        },
      },
    },
  });
};

export const removeMovies = async (movieIds: string[]) => {
  if (!movieIds) {
    throw new Error("Movie ID is required");
  }

  await Promise.all(
    movieIds.map((id) => {
      return db.movie.delete({
        where: {
          id,
        },
      });
    }),
  );
};

export const findMovieByTmdbId = async (tmdbId: number) => {
  return db.movie.findFirst({ where: { tmdbId } });
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
  const rows = await db.category.findMany({
    where: {
      name: { contains: query, mode: "insensitive", not: "" },
      movies: {
        some: unwatchedOnly ? { status: { not: MovieStatus.WATCHED } } : {},
      },
    },
    distinct: ["name"],
    orderBy: { name: "asc" },
    select: { name: true },
    take: 100,
  });

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

/**
 * A random movie that hasn't been watched yet, optionally limited to a
 * category (case-insensitive exact match). Undefined when nothing qualifies.
 */
export const pickRandomMovie = async ({
  categoryName,
}: { categoryName?: string } = {}) => {
  const movies = await db.movie.findMany({
    where: {
      status: { not: MovieStatus.WATCHED },
      ...(categoryName
        ? {
            category: {
              name: { equals: categoryName, mode: "insensitive" },
            },
          }
        : {}),
    },
    select: {
      movieName: true,
      releaseDate: true,
      selectedBy: true,
      category: { select: { name: true } },
    },
  });
  if (movies.length === 0) return undefined;
  return movies[Math.floor(Math.random() * movies.length)];
};
