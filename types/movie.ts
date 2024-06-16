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
