import { Link, json, useLoaderData } from "@remix-run/react";
import { DataTable } from "~/components/DataTable";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, ArrowUpDown } from "lucide-react";
import { Button, buttonVariants } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { fetchMovies } from "~/models/movie.server";

export const loader = async () => {
  const movies = await fetchMovies();

  return json(movies);
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
              Copy payment ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View customer</DropdownMenuItem>
            <DropdownMenuItem>View payment details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
