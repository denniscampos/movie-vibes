import { Link, json, useFetcher, useLoaderData } from "@remix-run/react";
import { DataTable } from "~/components/DataTable";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, ArrowUpDown } from "lucide-react";
import { Button, buttonVariants } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { changeMovieStatus, fetchMovies } from "~/models/movie.server";
import { ActionFunctionArgs } from "@remix-run/node";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { MovieStatus, MovieStatusType } from "~/lib/status";

export const loader = async () => {
  const movies = await fetchMovies();

  return json(movies);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();
  const movieId = body.get("movieId") as string;
  const movieStatus = body.get("movieStatus") as MovieStatus;

  const action = body.get("_action");

  if (action === "movieStatus") {
    await changeMovieStatus({ id: movieId, status: movieStatus });

    return json({ message: "Movie status updated" });
  }
};

export default function MoviesPage() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Movie Database</h2>
        <Link className={buttonVariants({ variant: "link" })} to="/movies/new">
          Add New Movie
        </Link>
      </div>
      <DataTable data={loaderData} columns={columns} />
    </div>
  );
}

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
      const movieId = row.original.id;

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
            <Link
              className="hover:bg-slate-100 relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              to={`/movies/${movieId}/update`}
            >
              Edit
            </Link>

            {/* <DropdownMenuItem onClick={() => navigator.clipboard.writeText("")}>
              Remove
            </DropdownMenuItem> */}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

interface SelectMovieStatusProps {
  movieId: string;
  movieStatus: MovieStatusType;
}

function SelectMovieStatus({ movieStatus, movieId }: SelectMovieStatusProps) {
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
