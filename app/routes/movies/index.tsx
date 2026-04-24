import { href, Link } from "react-router";
import { columns } from "~/components/Columns";
import { DataTable } from "~/components/DataTable";
import { buttonVariants } from "~/components/ui/button";
import { handleMovieAction } from "~/actions/movie.server";
import { fetchMovies } from "~/models/movie.server";
import { requireLogin } from "~/utils/auth.server";
import type { Route } from "./+types/index";

export const loader = async ({ request }: Route.LoaderArgs) => {
  await requireLogin(request);
  const movies = await fetchMovies();
  return movies;
};

export const action = ({ request }: Route.ActionArgs) => handleMovieAction(request);

export default function MoviesPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-semibold">Movie Database</h2>
        <Link className={buttonVariants()} to={href("/movies/new")}>
          + Add New Movie
        </Link>
      </div>
      <DataTable data={loaderData} columns={columns} />
    </div>
  );
}
