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
      status: "UPCOMING",
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
