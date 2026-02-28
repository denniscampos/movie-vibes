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

export type Genre = {
  id: number;
  name: string;
};

export type MovieAPIResponse = {
  id: number;
  title: string;
  release_date: string;
  poster_path?: string | null;
  overview?: string;
  genres?: Genre[];
  runtime?: number | null;
  vote_average?: number;
  vote_count?: number;
  status?: string;
  tagline?: string;
  original_language?: string;
  popularity?: number;
};
