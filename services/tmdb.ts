import { MovieAPITypes } from "types/movie";

export const searchMovie = async (query: string) => {
  const res = await fetch(
    `${process.env.TMDB_API_URL}/search/movie?query=${query}&include_adult=false&language=en-US&page=1`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch movies");
  }

  const data = await res.json();

  let results = [];

  if (data && data.results) {
    results = data.results.map((movie: MovieAPITypes) => ({
      id: movie.id,
      title: movie.title,
      releaseDate: movie.release_date,
      posterPath: movie.poster_path
        ? `${process.env.TMDB_API_IMAGE_URL}${movie.poster_path}`
        : null,
    }));
  }

  return results;
};

export const searchMovieById = async (id?: string) => {
  const res = await fetch(`${process.env.TMDB_API_URL}/movie/${id}?language=en-US`, {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch movie id ${id}`);
  }

  const data = await res.json();

  const result: MovieAPITypes = {
    id: data.id,
    title: data.title,
    release_date: data.release_date,
    poster_path: data.poster_path
      ? `${process.env.TMDB_API_IMAGE_URL}${data.poster_path}`
      : null,
    overview: data.overview,
  };

  return result;
};
