import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from "react-router";
import { searchMovie } from "services/tmdb";
import { MovieList } from "~/components/MovieList";
import { saveToDB } from "~/models/movie.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const searchResults = await searchMovie(q);

  return searchResults;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();

  const movieTitle = body.get("movieTitle") as string;
  const movieReleaseDate = body.get("movieReleaseDate") as string;
  const imageUrl = body.get("imageUrl") as string;

  await saveToDB({ movieName: movieTitle, releaseDate: movieReleaseDate, imageUrl });
  return redirect("/movies");
};

export default function SearchPage() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <div className="my-10 mx-auto">
      <MovieList movies={loaderData} />
    </div>
  );
}
