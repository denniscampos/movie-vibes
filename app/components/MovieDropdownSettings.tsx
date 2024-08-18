import { MoreHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Table } from "@tanstack/react-table";
import { Movies } from "types/movie";

interface MovieDropdownSettingsProps {
  movieId: string[];
  table: Table<Movies>;
}

export const MovieDropdownSettings = (props: MovieDropdownSettingsProps) => {
  const { movieId, table } = props;
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 relative">
            <span className="sr-only">Open menu</span>
            <MovieCount movieCount={movieId.length} />
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setShowRemoveDialog(true)}>
            Remove Movies
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RemoveDialog
        showRemoveDialog={showRemoveDialog}
        setShowRemoveDialog={setShowRemoveDialog}
        movieId={movieId}
        table={table}
      />
    </>
  );
};

function RemoveDialog({
  showRemoveDialog,
  setShowRemoveDialog,
  movieId,
  table,
}: {
  showRemoveDialog: boolean;
  setShowRemoveDialog: (value: boolean) => void;
  movieId: string[];
  table: Table<Movies>;
}) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state === "submitting";

  useEffect(() => {
    if (isDeleting) {
      setShowRemoveDialog(false);
      // deselect all rows when deleting.
      table.toggleAllRowsSelected(false);
    }
  });

  return (
    <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Remove Movies</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove {movieId.length} movies?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowRemoveDialog(!showRemoveDialog)}
          >
            Cancel
          </Button>
          <fetcher.Form method="delete">
            <input type="hidden" name="movieId" value={movieId.join(",")} />
            <Button
              disabled={isDeleting}
              type="submit"
              variant="destructive"
              name="_action"
              value="destroy"
            >
              {isDeleting ? "Removing..." : "Remove"}
            </Button>
          </fetcher.Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovieCount({ movieCount }: { movieCount: number }) {
  return (
    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary p-1 text-xs text-primary-foreground">
      {movieCount}
    </span>
  );
}
