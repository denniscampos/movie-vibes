import { json, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { DataTable } from "~/components/DataTable";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { fetchUpcomingMovies } from "~/models/movie.server";

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

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const spin = () => {
    const randomIndex = Math.floor(Math.random() * items.length);
    setSelectedItem(items[randomIndex]);
  };

  return (
    <div className="py-10">
      <h2 className="text-3xl font-semibold">Upcoming Movies</h2>
      <DataTable columns={columns} data={loaderData} />

      <div>
        <button onClick={spin}>Spin Picker</button>
        {selectedItem && <div>Selected: {selectedItem}</div>}
      </div>
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
