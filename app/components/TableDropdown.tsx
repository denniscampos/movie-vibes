import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { Movies } from "types/movie";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { useFetcher } from "@remix-run/react";
import { Input } from "./ui/input";

export function TableDropdown({ movie }: { movie: Omit<Movies, "status" | "imageUrl"> }) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowRemoveDialog(true)}>
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditDialog
        showEditDialog={showEditDialog}
        setShowEditDialog={setShowEditDialog}
        movie={movie}
      />
      <RemoveDialog
        showRemoveDialog={showRemoveDialog}
        setShowRemoveDialog={setShowRemoveDialog}
        movie={movie}
      />
    </>
  );
}

export function EditDialog({
  showEditDialog,
  setShowEditDialog,
  movie,
}: {
  showEditDialog: boolean;
  setShowEditDialog: (value: boolean) => void;
  movie: Omit<Movies, "status" | "imageUrl">;
}) {
  const fetcher = useFetcher();
  const isEditing = fetcher.state !== "idle";
  const data = fetcher.data;

  useEffect(() => {
    // @ts-expect-error cus ts is dumb sometimes
    if (data && data.updatedMovie) {
      setShowEditDialog(false);
    }
  }, [data, setShowEditDialog]);

  // @ts-expect-error cus ts is dumb sometimes
  const errors = data && data.error;

  return (
    <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Movie</DialogTitle>
          <DialogDescription>
            Make changes to your movie here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form method="POST">
          <input type="hidden" name="movieId" value={movie.id} />
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="movieName" className="text-right">
                Name
              </Label>
              <Input
                id="movieName"
                name="movieName"
                defaultValue={movie.movieName}
                className="col-span-3"
                type="text"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="releaseDate" className="text-right">
                Release Date
              </Label>
              <Input
                id="releaseDate"
                name="releaseDate"
                defaultValue={movie.releaseDate}
                className="col-span-3"
                type="text"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="categoryName" className="text-right">
                Category
              </Label>
              <Input
                id="categoryName"
                name="categoryName"
                defaultValue={movie.category.name}
                className="col-span-3"
                type="text"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="selectedBy" className="text-right">
                Selected by
              </Label>
              <Input
                id="selectedBy"
                name="selectedBy"
                defaultValue={movie.selectedBy}
                className="col-span-3"
                type="text"
              />
            </div>
          </div>
          {errors && <p className="text-red-500">Your form had an error!</p>}
          <Button disabled={isEditing} name="_action" value="update" type="submit">
            {isEditing ? "Saving..." : "Save changes"}
          </Button>
        </fetcher.Form>
        <DialogFooter></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({
  showRemoveDialog,
  setShowRemoveDialog,
  movie,
}: {
  showRemoveDialog: boolean;
  setShowRemoveDialog: (value: boolean) => void;
  movie: Pick<Movies, "id">;
}) {
  const fetcher = useFetcher();
  const isDeleting = fetcher.state !== "idle";

  useEffect(() => {
    if (isDeleting) {
      setShowRemoveDialog(false);
    }
  });

  return (
    <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Remove Movie</DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this movie?
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
            <input type="hidden" name="movieId" value={movie.id} />
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
