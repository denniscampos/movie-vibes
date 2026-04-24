import { href, Link } from "react-router";
import {
  getGenreList,
  getNewReleases,
  getPopularMoviesByGenre,
  getRecommendedMovies,
} from "services/tmdb";
import type { MovieAPIResponse } from "types/movie";
import { Poster } from "~/components/mv";
import { requireLogin } from "~/utils/auth.server";
import type { Route } from "./+types/genreId";

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  await requireLogin(request);

  const genreId = String(params.genreId);
  const genres = await getGenreList();
  const genre = genres.find((g) => String(g.id) === genreId);

  const [movies, newReleases, recommendedMovies] = await Promise.all([
    getPopularMoviesByGenre({ genreId: Number(genreId) }),
    getNewReleases({ genreId: Number(genreId) }),
    getRecommendedMovies({ genreId: Number(genreId) }),
  ]);

  const aisleNumber = genre
    ? genres.findIndex((g) => g.id === genre.id) + 1
    : 0;

  return {
    movies,
    newReleases,
    recommendedMovies,
    genreName: genre?.name ?? "Movies",
    aisleNumber,
  };
};

export default function MovieCategoryPage({ loaderData }: Route.ComponentProps) {
  const { movies, newReleases, recommendedMovies, genreName, aisleNumber } =
    loaderData;

  return (
    <div className="py-10">
      <Link
        to={href("/browse")}
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-ink"
      >
        ← back to aisle directory
      </Link>

      <div className="mb-[6px] mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        {aisleNumber > 0
          ? `▸ aisle a${aisleNumber} · full shelf`
          : "▸ full shelf"}
      </div>
      <h1 className="m-0 mb-8 font-hand-2 text-[40px] text-ink">{genreName}</h1>

      <Shelf label="Popular" movies={movies} />
      <Shelf label="New Releases" movies={newReleases} />
      <Shelf label="Staff Recommendations" movies={recommendedMovies} />
    </div>
  );
}

function Shelf({ label, movies }: { label: string; movies: MovieAPIResponse[] }) {
  if (!movies || movies.length === 0) return null;
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-baseline justify-between border-b-2 border-dashed border-rule pb-2">
        <h2 className="m-0 font-hand-2 text-2xl text-ink">{label}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
          {movies.length} on the shelf
        </span>
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-[18px] overflow-x-auto px-1 pb-4">
        {movies.map((m, i) => {
          const year = m.release_date?.split("-")[0];
          return (
            <Link
              key={m.id}
              to={href("/movies/:id", { id: String(m.id) })}
              className="flex w-[160px] flex-none snap-start flex-col gap-[6px]"
            >
              <Poster
                movie={{
                  id: String(m.id),
                  title: m.title,
                  year,
                  posterUrl: m.poster_path ?? undefined,
                }}
                tilt={i % 2 ? 0.6 : -0.6}
                size="md"
              />
              <div className="font-hand-2 text-[13px] leading-[1.1] text-ink">
                {m.title}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                {year ?? "—"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
