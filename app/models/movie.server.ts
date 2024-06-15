import { db } from "~/db.server";

export const fetchMovies = async () => {
  return db.movie.findMany();
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
