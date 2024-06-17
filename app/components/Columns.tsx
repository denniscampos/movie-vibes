import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Movies } from "types/movie";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { SelectMovieStatus } from "./SelectMovieStatus";
import { TableDropdown } from "./TableDropdown";

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
          className="p-0"
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
    header: ({ column }) => {
      return (
        <Button
          className="p-0"
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Selected By
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
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
