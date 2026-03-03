import {
  Link,
  LoaderFunctionArgs,
  redirect,
  useLoaderData,
  useLocation,
  useNavigate,
} from "react-router";
import { getGenreList, searchMoviesByGenre } from "services/tmdb";
import { Genre, MovieAPIResponse } from "types/movie";
import { usernameCookie } from "utils/cookies";
import { MoviePoster } from "~/components/MoviePoster";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  const userVisited = (await usernameCookie.parse(cookieHeader)) || false;

  if (!userVisited) {
    return redirect("/login");
  }
  const genres = await getGenreList();
  const url = new URL(request.url);
  const genreId = url.searchParams.get("genre") || genres[0]?.id;

  let movies = [];
  if (genreId) {
    const genre = genres.find((genre) => String(genre.id) === String(genreId));
    if (genre) {
      movies = await searchMoviesByGenre({ genre });
    }
  }

  return {
    genres,
    movies,
    selectedGenreId: genreId,
  };
};

export default function BrowsePage() {
  const loaderData = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const location = useLocation();

  const { genres: categories, movies, selectedGenreId } = loaderData;

  const handleCategoryClick = (genre: Genre) => {
    const params = new URLSearchParams(location.search);
    params.set("genre", genre.id.toString());
    navigate(`?${params.toString()}`, { preventScrollReset: true });
  };

  const selectedCategory = categories.find(
    (category) => String(category.id) === String(selectedGenreId),
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-semibold">Browse by Category</h3>
        {selectedCategory && (
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "text-sm")}
            to={`/movies/genre/${selectedGenreId}`}
          >
            View all {selectedCategory.name} movies
          </Link>
        )}
      </div>
      <div className="flex flex-row flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button key={category.id} onClick={() => handleCategoryClick(category)}>
            <Category
              category={category.name}
              selected={String(selectedGenreId) === String(category.id)}
            />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {movies.map((movie: MovieAPIResponse) => (
          <Link to={`/movie/${movie.id}`} key={movie.id}>
            <div className="w-full">
              <MoviePoster src={movie.poster_path} alt={movie.title} className="h-full" />
              <h3 className="text-sm font-medium mt-2 line-clamp-2">{movie.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Category({
  category,
  selected,
}: {
  category: string;
  selected?: boolean;
}) {
  return <Badge variant={selected ? "default" : "outline"}>{category}</Badge>;
}
