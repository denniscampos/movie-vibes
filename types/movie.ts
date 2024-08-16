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
};

export type MovieAPITypes = {
  id: number;
  title: string;
  release_date: string;
  poster_path?: string | null;
  overview?: string;
};
