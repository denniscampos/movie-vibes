import { ActionFunctionArgs, json, type MetaFunction } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { searchMovie } from "services/tmdb";
import { Movies } from "types/movie";
import { DataTable } from "~/components/DataTable";
import { MovieList } from "~/components/MovieList";
import { SearchMovies } from "~/components/SearchMovies";
import { SelectMovieStatus } from "~/components/SelectMovieStatus";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { MovieStatus } from "~/lib/status";
import { changeMovieStatus, fetchUpcomingMovies } from "~/models/movie.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Movie Vibes" },
    { name: "description", content: "Vibe with yo friends." },
  ];
};

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

  if (action === "movieStatus") {
    await changeMovieStatus({ id: movieId, status: movieStatus });

    return json({ message: "Movie status updated" });
  }

  const searchResults = await searchMovie(search as string);

  return json(searchResults);
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
      const payment = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(payment.id)}>
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
