import { MovieStatus } from "../../prisma/generated/prisma/enums";
import { db } from "~/db.server";

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
}: {
  movieName: string;
  releaseDate: string;
  selectedBy: string;
  categoryName: string;
  status: MovieStatus;
  imageUrl?: string;
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
}: {
  movieName: string;
  releaseDate: string;
  imageUrl?: string;
}) => {
  const getYear = releaseDate.split("-")[0];
  return db.movie.create({
    data: {
      movieName,
      releaseDate: getYear,
      // everything below will be empty since the goal is to update the movie later
      category: {
        create: {
          name: "",
        },
      },
      imageUrl,
      status: MovieStatus.NOT_WATCHED,
      selectedBy: "",
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
    })
  );
};
