import { MovieStatus } from "@prisma/client";
import { db } from "~/db.server";

export const fetchMovies = async () => {
  const movie = await db.movie.findMany({
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
}: {
  movieName: string;
  releaseDate: string;
  selectedBy: string;
  categoryName: string;
  status: MovieStatus;
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
}: {
  movieName: string;
  releaseDate: string;
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

export const removeMovie = async (movieId: string) => {
  return db.movie.delete({
    where: {
      id: movieId,
    },
  });
};
