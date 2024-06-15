import { db } from "~/db.server";

export const fetchMovies = async () => {
  const movie = await db.movie.findMany({
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
    },
  });

  return movie;
};

export const fetchUpcomingMovies = async () => {
  const upcomingMovies = await db.movie.findMany({
    where: {
      watched: true,
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
    },
  });

  return upcomingMovies;
};

export const createMovie = async ({
  movieName,
  releaseDate,
  selectedBy,
  categoryName,
}: {
  movieName: string;
  releaseDate: string;
  selectedBy: string;
  categoryName: string;
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
    },
  });
};
