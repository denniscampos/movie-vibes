import { Movies } from "types/movie";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useFetcher } from "react-router";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { SelectMovieStatus } from "./SelectMovieStatus";
import { MoviePoster } from "./MoviePoster";

interface UpcomingMoviesProps {
  movies: Movies[];
}

export function UpcomingMovies({ movies }: UpcomingMoviesProps) {
  return (
    <div className="container mx-auto p-4">
      <h2 className="text-xl sm:text-3xl font-bold mb-6">Upcoming Movie Night Picks</h2>
      <div className="relative">
        <div className="flex overflow-x-auto gap-6 pb-4 snap-x snap-mandatory">
          {movies.map((movie) => (
            <Card key={movie.id} className="flex-none w-[200px] snap-start p-0">
              <CardHeader className="p-0">
                <MoviePoster
                  src={movie.imageUrl ?? undefined}
                  alt={`${movie.movieName} poster`}
                />
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium line-clamp-2">
                    {movie.movieName}
                  </CardTitle>
                  <UpcomingMoviesDropdown movie={movie} />
                </div>
                <span className="text-xs text-muted-foreground">{movie.releaseDate}</span>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <span className="text-xs text-muted-foreground">
                  Picked by {movie.selectedBy}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function UpcomingMoviesDropdown({ movie }: { movie: Movies }) {
  const [showEditDialog, setShowEditDialog] = useState(false);

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
        </DropdownMenuContent>
      </DropdownMenu>
      <UpcomingMoviesDialog
        showEditDialog={showEditDialog}
        setShowEditDialog={setShowEditDialog}
        movie={movie}
      />
    </>
  );
}

function UpcomingMoviesDialog({
  showEditDialog,
  setShowEditDialog,
  movie,
}: {
  showEditDialog: boolean;
  setShowEditDialog: (value: boolean) => void;
  movie: Movies;
}) {
  const fetcher = useFetcher();
  const isEditing = fetcher.state !== "idle";
  const data = fetcher.data;

  useEffect(() => {
    if (data && data.updatedMovie) {
      setShowEditDialog(false);
    }
  }, [data, setShowEditDialog]);

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

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="movieStatus" className="text-right">
                Status
              </Label>
              <SelectMovieStatus movieStatus={movie.status} movieId={movie.id} />
            </div>
          </div>
          {/* {errors && <p className="text-red-500">Your form had an error!</p>} */}
          <Button name="_action" value="update" type="submit">
            {isEditing ? "Saving..." : "Save changes"}
          </Button>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
