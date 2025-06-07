import { Form, Link, useNavigation } from "react-router";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
import { MoviePoster } from "./MoviePoster";

interface MovieListProps {
  id: number;
  title: string;
  releaseDate: string;
  posterPath: string;
}

export function MovieList({ movies }: { movies: MovieListProps[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {movies.length === 0 ? (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          No movies found. Please try a different search.
        </div>
      ) : null}
      {movies &&
        movies.map((movie) => (
          <div key={movie.id} className="group relative flex flex-col">
            <Link to={`/movie/${movie.id}`} className="block">
              <div className="aspect-[2/3] overflow-hidden rounded-lg">
                <MoviePoster src={movie.posterPath} alt={movie.title} />
              </div>
              <div className="mt-2 space-y-1">
                <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                  {movie.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {new Date(movie.releaseDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </Link>
            <div className="mt-2">
              <SaveMovieButton movie={movie} />
            </div>
          </div>
        ))}
    </div>
  );
}

export function SaveMovieButton({ movie }: { movie: MovieListProps }) {
  const navigation = useNavigation();
  const loading =
    navigation.state === "submitting" &&
    navigation.formMethod === "POST" &&
    // Ensures the loading state applies to the correct movie title
    navigation.formData?.get("movieTitle") === movie.title;

  return (
    <Form method="POST">
      <input type="hidden" name="movieTitle" value={movie.title} />
      <input type="hidden" name="movieReleaseDate" value={movie.releaseDate} />
      <input type="hidden" name="imageUrl" value={movie.posterPath} />

      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : "Save Movie to DB"}
      </Button>
    </Form>
  );
}
