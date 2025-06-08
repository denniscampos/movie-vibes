import { Link, LoaderFunctionArgs, useLoaderData } from "react-router";
import {
  getNewReleases,
  getPopularMoviesByGenre,
  getRecommendedMovies,
  getGenreList,
} from "services/tmdb";
import { MovieAPIResponse } from "types/movie";
import { MoviePoster } from "~/components/MoviePoster";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const genreId = String(params.genreId);
  const genres = await getGenreList();
  const genre = genres.find((g) => String(g.id) === genreId);

  const [movies, newReleases, recommendedMovies] = await Promise.all([
    getPopularMoviesByGenre({ genreId: Number(genreId) }),
    getNewReleases({ genreId: Number(genreId) }),
    getRecommendedMovies({ genreId: Number(genreId) }),
  ]);

  return {
    movies,
    newReleases,
    recommendedMovies,
    genreName: genre?.name ?? "Movies",
  };
};

export default function MovieCategoryPage() {
  const loaderData = useLoaderData<typeof loader>();
  const movies = loaderData.movies;
  const newReleases = loaderData.newReleases;
  const recommendedMovies = loaderData.recommendedMovies;
  const genreName = loaderData.genreName;

  return (
    <div className="space-y-12 pt-12">
      <h1 className="text-3xl font-bold mb-8">{genreName}</h1>

      {/*POPULAR SECTION */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Popular Movies</h2>
        <div className="relative">
          <div className="flex overflow-x-auto gap-6 pb-4 snap-x snap-mandatory">
            {movies.map((movie: MovieAPIResponse) => (
              <Link to={`/movie/${movie.id}`} key={movie.id}>
                <div className="flex-none w-[200px] snap-start">
                  <MoviePoster src={movie.poster_path} alt={movie.title} />
                  <h3 className="mt-2 text-sm font-medium line-clamp-2">{movie.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* NEW RELEASES SECTION */}
      <section>
        <h2 className="text-2xl font-bold mb-6">New Releases</h2>
        <div className="relative">
          <div className="flex overflow-x-auto gap-6 pb-4 snap-x snap-mandatory">
            {newReleases.map((movie: MovieAPIResponse) => (
              <Link to={`/movie/${movie.id}`} key={movie.id}>
                <div className="flex-none w-[200px] snap-start">
                  <MoviePoster src={movie.poster_path} alt={movie.title} />
                  <h3 className="mt-2 text-sm font-medium line-clamp-2">{movie.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* RECOMMENDED SECTION */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Recommended Movies</h2>
        <div className="relative">
          <div className="flex overflow-x-auto gap-6 pb-4 snap-x snap-mandatory">
            {recommendedMovies.map((movie: MovieAPIResponse) => (
              <Link to={`/movie/${movie.id}`} key={movie.id}>
                <div className="flex-none w-[200px] snap-start">
                  <MoviePoster src={movie.poster_path} alt={movie.title} />
                  <h3 className="mt-2 text-sm font-medium line-clamp-2">{movie.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
