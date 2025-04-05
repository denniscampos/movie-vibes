import { useFetcher } from "react-router";
import { useEffect } from "react";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";

interface RemoveMoviesProps {
  movieIds: string[];
  onRowSelectionChange: (value: object) => void;
}

export const RemoveMovies = (props: RemoveMoviesProps) => {
  const { movieIds, onRowSelectionChange } = props;
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "submitting") {
      onRowSelectionChange({});
    }
  }, [fetcher.state, onRowSelectionChange]);

  return (
    <fetcher.Form method="delete">
      <input type="hidden" name="movieId" value={movieIds.join(",")} />
      <Button size="icon" variant="destructive" name="_action" value="destroy">
        <Trash2 className="h-4 w-4" />
      </Button>
    </fetcher.Form>
  );
};
