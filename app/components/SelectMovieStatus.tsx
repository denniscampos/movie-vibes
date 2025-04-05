import { useFetcher } from "react-router";
import { MovieStatus, MovieStatusType } from "~/lib/status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface SelectMovieStatusProps {
  movieId: string;
  movieStatus: MovieStatusType;
}
export function SelectMovieStatus({ movieStatus, movieId }: SelectMovieStatusProps) {
  const fetcher = useFetcher();

  return (
    <Select
      value={movieStatus}
      onValueChange={(value) => {
        fetcher.submit(
          {
            movieId,
            movieStatus: value,
            _action: "movieStatus",
          },
          {
            method: "POST",
          }
        );
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Movie Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={MovieStatus.NOT_WATCHED}>Not Watched</SelectItem>
        <SelectItem value={MovieStatus.UPCOMING}>Upcoming</SelectItem>
        <SelectItem value={MovieStatus.WATCHED}>Watched</SelectItem>
      </SelectContent>
    </Select>
  );
}
