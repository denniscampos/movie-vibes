import {
  Link,
  redirect,
  useLoaderData,
  ActionFunctionArgs,
  LoaderFunctionArgs,
  href,
} from "react-router";
import { DataTable } from "~/components/DataTable";
import { buttonVariants } from "~/components/ui/button";
import { fetchMovies } from "~/models/movie.server";
import { columns } from "~/components/Columns";
import { usernameCookie } from "utils/cookies";
import { handleMovieAction } from "~/actions/movie.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  const userVisited = (await usernameCookie.parse(cookieHeader)) || false;

  if (!userVisited) {
    return redirect("/login");
  }

  const movies = await fetchMovies();

  return movies;
};

export const action = ({ request }: ActionFunctionArgs) => handleMovieAction(request);

export default function MoviesPage() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <div className="py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-3xl font-semibold">Movie Database</h2>
        <Link className={buttonVariants()} to={href(`/movies/new`)}>
          + Add New Movie
        </Link>
      </div>
      <DataTable data={loaderData} columns={columns} />
    </div>
  );
}
