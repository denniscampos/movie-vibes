import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from "react-router";
import { searchMovie } from "services/tmdb";
import { MovieList } from "~/components/MovieList";
import { saveToDB } from "~/models/movie.server";
import { SearchMovies } from "~/components/SearchMovies";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const searchResults = await searchMovie(q);

  return { searchResults, query: q };
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
  const { searchResults, query } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-center mb-6">Search Movies</h1>
        <SearchMovies />
      </div>

      {query && (
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">
            {searchResults.length > 0
              ? `Search Results for "${query}"`
              : `No results found for "${query}"`}
          </h2>
          <div className="bg-muted/50 rounded-lg p-6">
            <MovieList movies={searchResults} />
          </div>
        </div>
      )}
    </div>
  );
}
