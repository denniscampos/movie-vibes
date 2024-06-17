import { Link, json, redirect, useLoaderData } from "@remix-run/react";
import { DataTable } from "~/components/DataTable";
import { buttonVariants } from "~/components/ui/button";
import { changeMovieStatus, fetchMovies, removeMovie } from "~/models/movie.server";
import { ActionFunctionArgs } from "@remix-run/node";
import { MovieStatus } from "~/lib/status";
import { columns } from "~/components/Columns";

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

  if (action === "destroy") {
    const movieId = body.get("movieId") as string;
    await removeMovie(movieId);

    return redirect("/movies");
  }

  return null;
};

export default function MoviesPage() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <div className="py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Movie Database</h2>
        <Link className={buttonVariants()} to="/movies/new">
          + Add New Movie
        </Link>
      </div>
      <DataTable data={loaderData} columns={columns} />
    </div>
  );
}
