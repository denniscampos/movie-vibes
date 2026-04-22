import {
  Link,
  useLoaderData,
  ActionFunctionArgs,
  LoaderFunctionArgs,
  href,
} from "react-router";
import { DataTable } from "~/components/DataTable";
import { buttonVariants } from "~/components/ui/button";
import { fetchMovies } from "~/models/movie.server";
import { columns } from "~/components/Columns";
import { requireLogin } from "~/utils/auth.server";
import { handleMovieAction } from "~/actions/movie.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireLogin(request);

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
