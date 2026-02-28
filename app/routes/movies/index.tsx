import {
  Link,
  redirect,
  useLoaderData,
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import { DataTable } from "~/components/DataTable";
import { buttonVariants } from "~/components/ui/button";
import {
  changeMovieStatus,
  fetchMovies,
  removeMovies,
  updateMovie,
} from "~/models/movie.server";
import { MovieStatus } from "~/lib/status";
import { columns } from "~/components/Columns";
import { z } from "zod";
import { usernameCookie } from "utils/cookies";

const updateMovieSchema = z.object({
  movieName: z.string().min(1, { message: "Movie name is required" }),
  releaseDate: z.string().min(1, { message: "Release date is required" }),
  selectedBy: z.string().min(1, { message: "Selected by is required" }),
  categoryName: z.string().min(1, { message: "Category name is required" }),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  const userVisited = (await usernameCookie.parse(cookieHeader)) || false;

  if (!userVisited) {
    return redirect("/login");
  }

  const movies = await fetchMovies();

  return movies;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();

  const action = body.get("_action");

  if (action === "movieStatus") {
    const movieId = body.get("movieId") as string;
    const movieStatus = body.get("movieStatus") as MovieStatus;
    await changeMovieStatus({ id: movieId, status: movieStatus });

    return { message: "Movie status updated" };
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
      return { updatedMovie };
    } catch (error) {
      return { error };
    }
  }

  if (action === "destroy") {
    const movieId = body.get("movieId") as string;
    await removeMovies(movieId.split(","));
    return { success: true };
  }
};

export default function MoviesPage() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <div className="py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-semibold">Movie Database</h2>
        <Link className={buttonVariants()} to="/movies/new">
          + Add New Movie
        </Link>
      </div>
      <DataTable data={loaderData} columns={columns} />
    </div>
  );
}
