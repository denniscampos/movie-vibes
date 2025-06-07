import { Genre, MovieAPIResponse } from "types/movie";
import { genreCache, releaseCache, recommendedCache } from "~/lib/cache";

export async function searchMovie(query: string) {
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
    results = data.results.map((movie: MovieAPIResponse) => ({
      id: movie.id,
      title: movie.title,
      releaseDate: movie.release_date,
      posterPath: movie.poster_path
        ? `${process.env.TMDB_API_IMAGE_URL}${movie.poster_path}`
        : null,
    }));
  }

  return results;
}

export async function searchMovieById(id?: string) {
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

  const result: MovieAPIResponse = {
    id: data.id,
    title: data.title,
    release_date: data.release_date,
    poster_path: data.poster_path
      ? `${process.env.TMDB_API_IMAGE_URL}${data.poster_path}`
      : null,
    overview: data.overview,
  };

  return result;
}

export async function searchMoviesByGenre({ genre }: { genre: Genre }) {
  const res = await fetch(
    `${process.env.TMDB_API_URL}/discover/movie?with_genres=${genre.id}&language=en-US&page=1`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch movies by genre ${genre.name}`);
  }

  const data = await res.json();

  const results = data.results
    .map((movie: MovieAPIResponse) => ({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      poster_path: movie.poster_path
        ? `${process.env.TMDB_API_IMAGE_URL}${movie.poster_path}`
        : null,
    }))
    .slice(0, 8);

  return results;
}

export async function getGenreList() {
  let genreMap = genreCache.get("genres");

  if (!genreMap) {
    const res = await fetch(
      `${process.env.TMDB_API_URL}/genre/movie/list?language=en-US`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to fetch genre list");
    }

    const data = await res.json();

    genreMap = new Map(data.genres.map((genre: Genre) => [genre.id, genre]));

    genreCache.set("genres", genreMap);
  }

  return Array.from(genreMap.values());
}

export async function getPopularMoviesByGenre({ genreId }: { genreId: number }) {
  const res = await fetch(
    `${process.env.TMDB_API_URL}/discover/movie?language=en-US&page=1&with_genres=${genreId}&sort_by=popularity.desc`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch popular movies");
  }

  const data = await res.json();
  const results = data.results.map((movie: MovieAPIResponse) => ({
    ...movie,
    poster_path: movie.poster_path
      ? `${process.env.TMDB_API_IMAGE_URL}${movie.poster_path}`
      : null,
  }));
  return results;
}

export async function getNewReleases({ genreId }: { genreId: number }) {
  const releasesMap = releaseCache.get("releases");

  if (!releasesMap) {
    const res = await fetch(
      `${process.env.TMDB_API_URL}/discover/movie?language=en-US&page=1&with_genres=${genreId}&sort_by=primary_release_date.desc&primary_release_date.lte=2025-06-06`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to fetch popular movies");
    }

    const data = await res.json();

    const results = data.results.map((movie: MovieAPIResponse) => ({
      ...movie,
      poster_path: movie.poster_path
        ? `${process.env.TMDB_API_IMAGE_URL}${movie.poster_path}`
        : null,
    }));

    releaseCache.set("releases", results);

    return results;
  }

  return Array.from(releasesMap.values());
}

export async function getRecommendedMovies({ genreId }: { genreId: number }) {
  const recommendedMap = recommendedCache.get("recommended");

  if (!recommendedMap) {
    const res = await fetch(
      `${process.env.TMDB_API_URL}/discover/movie?language=en-US&page=1&with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=200`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to fetch popular movies");
    }

    const data = await res.json();
    const results = data.results.map((movie: MovieAPIResponse) => ({
      ...movie,
      poster_path: movie.poster_path
        ? `${process.env.TMDB_API_IMAGE_URL}${movie.poster_path}`
        : null,
    }));

    recommendedCache.set("recommended", results);

    return results;
  }

  return Array.from(recommendedMap.values());
}
