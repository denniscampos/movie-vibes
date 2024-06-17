import { ActionFunctionArgs, json, type MetaFunction } from "@remix-run/node";
import {
  Form,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
} from "@remix-run/react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { searchMovie } from "services/tmdb";
import { Movies } from "types/movie";
import { z } from "zod";
import { DataTable } from "~/components/DataTable";
import { MovieList } from "~/components/MovieList";
import { SearchMovies } from "~/components/SearchMovies";
import { SelectMovieStatus } from "~/components/SelectMovieStatus";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { MovieStatus } from "~/lib/status";
import {
  changeMovieStatus,
  fetchUpcomingMovies,
  removeMovie,
  saveToDB,
  updateMovie,
} from "~/models/movie.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Movie Vibes" },
    { name: "description", content: "Vibe with yo friends." },
  ];
};

const updateMovieSchema = z.object({
  movieName: z.string().min(1, { message: "Movie name is required" }),
  releaseDate: z.string().min(1, { message: "Release date is required" }),
  selectedBy: z.string().min(1, { message: "Selected by is required" }),
  categoryName: z.string().min(1, { message: "Category name is required" }),
});

// const resolver = zodResolver(createMovieSchema);
const items = ["dnbull", "Lumster", "mon-ster", "Shway", "shwaj"];

export const loader = async () => {
  const upcomingMovies = await fetchUpcomingMovies();

  return json(upcomingMovies);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();
  const movieId = body.get("movieId") as string;
  const movieStatus = body.get("movieStatus") as MovieStatus;

  const action = body.get("_action");
  const search = body.get("searchMovies");

  const movieTitle = body.get("movieTitle") as string;
  const movieReleaseDate = body.get("movieReleaseDate") as string;

  if (action === "movieStatus") {
    await changeMovieStatus({ id: movieId, status: movieStatus });

    return json({ message: "Movie status updated" });
  }

  if (action === "create") {
    await saveToDB({ movieName: movieTitle, releaseDate: movieReleaseDate });
    return redirect("/movies");
  }

  if (action === "search") {
    const searchResults = await searchMovie(search as string);

    return json(searchResults);
  }

  if (action === "update") {
    const movieId = body.get("movieId") as string;
    const movieName = body.get("movieName") as string;
    const releaseDate = body.get("releaseDate") as string;
    const selectedBy = body.get("selectedBy") as string;
    const categoryName = body.get("categoryName") as string;

    try {
      const parseData = updateMovieSchema.parse({
        movieName,
        releaseDate,
        selectedBy,
        categoryName,
      });

      const updatedMovie = await updateMovie({ ...parseData, movieId });
      return json({ updatedMovie });
    } catch (error) {
      return json({ error });
    }
  }

  if (action === "destroy") {
    await removeMovie(movieId);

    return redirect("/");
  }

  // return null;
};

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const spin = () => {
    setIsSpinning(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * items.length);
      setSelectedItem(items[randomIndex]);
      setIsSpinning(false);
    }, 3000);
  };

  return (
    <div className="py-10">
      <SearchMovies />
      <MovieList movies={actionData} />

      <h2 className="text-3xl font-semibold">Upcoming Movies</h2>

      <DataTable columns={columns} data={loaderData} />

      <div className="mt-10">
        <h3 className="text-2xl font-semibold mb-2">WHOSE MOVIE ARE WE PICKING?</h3>
        <Button onClick={spin}>Spin Picker</Button>

        <div className="mt-10 flex justify-center items-center">
          {isSpinning && (
            <div className="spinner-border animate-spin inline-block w-16 h-16 border-4 rounded-full border-t-blue-500 border-r-transparent border-b-transparent border-l-blue-500">
              <span className="sr-only">Loading...</span>
            </div>
          )}

          {!isSpinning && selectedItem && (
            <div className="text-2xl font-bold text-green-600">
              Selected: {selectedItem}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const columns: ColumnDef<Movies>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "movieName",
    header: "Movie Name",
  },
  {
    accessorKey: "releaseDate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Release Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },

  {
    accessorKey: "category.name",
    header: () => <div>Category</div>,
  },
  {
    accessorKey: "selectedBy",
    header: "Selected By",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const movieId = row.original.id;
      const movieStatus = row.original.status;

      return <SelectMovieStatus movieStatus={movieStatus} movieId={movieId} />;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const movie = {
        id: row.original.id,
        movieName: row.original.movieName,
        releaseDate: row.original.releaseDate,
        category: row.original.category,
        selectedBy: row.original.selectedBy,
      };

      return <TableDropdown movie={movie} />;
    },
  },
];

function TableDropdown({ movie }: { movie: Omit<Movies, "status"> }) {
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

function EditDialog({
  showEditDialog,
  setShowEditDialog,
  movie,
}: {
  showEditDialog: boolean;
  setShowEditDialog: (value: boolean) => void;
  movie: Omit<Movies, "status">;
}) {
  const fetcher = useFetcher();
  const data = fetcher.data;

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
          <Button name="_action" value="update" type="submit">
            Save changes
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
          <Form method="delete">
            <input type="hidden" name="movieId" value={movie.id} />
            <Button type="submit" variant="destructive" name="_action" value="destroy">
              Remove
            </Button>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
