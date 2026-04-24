import { MovieStatusType } from "~/lib/status";

export type Movies = {
  id: string;
  movieName: string;
  releaseDate: string;
  category: {
    name: string;
  };
  selectedBy: string;
  status: MovieStatusType;
  imageUrl?: string | null;
};

export type MovieAPIResponse = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  overview?: string;
};

export type MovieDetailResponse = MovieAPIResponse & {
  tagline: string | null;
  runtime: number | null;
  genres: Genre[];
  director: string | null;
  vote_average: number;
  vote_count: number;
};

export type Genre = {
  id: number;
  name: string;
};
