import { href, Link, useSearchParams } from "react-router";
import { getGenreList, searchMoviesByGenre } from "services/tmdb";
import type { Genre, MovieAPIResponse } from "types/movie";
import { Poster } from "~/components/mv";
import { cn } from "~/lib/utils";
import { requireLogin } from "~/utils/auth.server";
import type { Route } from "./+types/browse";

export const loader = async ({ request }: Route.LoaderArgs) => {
  await requireLogin(request);

  const genres = await getGenreList();
  const url = new URL(request.url);
  const genreId = url.searchParams.get("genre") || genres[0]?.id;

  let movies: MovieAPIResponse[] = [];
  if (genreId) {
    const genre = genres.find((g) => String(g.id) === String(genreId));
    if (genre) {
      movies = await searchMoviesByGenre({ genre });
    }
  }

  return { genres, movies, selectedGenreId: genreId };
};

export default function BrowsePage({ loaderData }: Route.ComponentProps) {
  const { genres, movies, selectedGenreId } = loaderData;
  const [, setSearchParams] = useSearchParams();

  const handleCategoryClick = (genre: Genre) => {
    setSearchParams(
      (prev) => {
        prev.set("genre", String(genre.id));
        return prev;
      },
      { preventScrollReset: true },
    );
  };

  const selectedGenre = genres.find(
    (g) => String(g.id) === String(selectedGenreId),
  );
  const aisleNumber =
    selectedGenre != null
      ? genres.findIndex((g) => g.id === selectedGenre.id) + 1
      : 0;

  return (
    <div className="py-8">
      <div className="mb-[6px] font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        ▸ aisle directory
      </div>
      <h1 className="m-0 mb-5 font-hand-2 text-4xl text-ink">The Video Store</h1>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside className="font-mono text-[12px]">
          {genres.map((g, i) => {
            const active = String(g.id) === String(selectedGenreId);
            return (
              <button
                key={g.id}
                onClick={() => handleCategoryClick(g)}
                className={cn(
                  "flex w-full items-center justify-between border-b border-dashed border-rule px-3 py-[10px] text-left uppercase tracking-[0.1em]",
                  active ? "text-accent" : "text-ink-soft hover:text-ink",
                )}
              >
                <span>{active ? "▸ " : ""}{g.name}</span>
                <span className="text-rule">A{i + 1}</span>
              </button>
            );
          })}
        </aside>

        <div>
          {selectedGenre && (
            <div className="mb-[14px] flex items-center justify-between border-t-[3px] border-accent bg-card px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
              <span>
                ✱ Aisle A{aisleNumber} · {selectedGenre.name} · {movies.length}{" "}
                on the shelf ✱
              </span>
              <Link
                to={href("/movies/genre/:genreId", {
                  genreId: String(selectedGenre.id),
                })}
                className="text-muted hover:text-accent"
              >
                view all →
              </Link>
            </div>
          )}

          {movies.length === 0 ? (
            <div className="rounded-[6px] border-2 border-dashed border-rule p-[60px] text-center font-hand text-[16px] text-muted">
              {selectedGenre
                ? `The ${selectedGenre.name.toLowerCase()} aisle is bare.`
                : "Pick an aisle to start browsing."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-[14px] border-b-[6px] border-accent pb-[18px] sm:grid-cols-3 md:grid-cols-4">
              {movies.map((movie, i) => (
                <Link
                  key={movie.id}
                  to={href("/movies/:id", { id: String(movie.id) })}
                  className="flex flex-col"
                >
                  <Poster
                    movie={{
                      id: String(movie.id),
                      title: movie.title,
                      year: movie.release_date?.split("-")[0],
                      posterUrl: movie.poster_path ?? undefined,
                    }}
                    tilt={i % 2 ? 0.6 : -0.6}
                    size="md"
                  />
                  <div className="mt-[6px] font-hand-2 text-[13px] leading-[1.1] text-ink">
                    {movie.title}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-soft">
                    {movie.release_date?.split("-")[0] ?? "—"} · tap →
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-[12px] font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            · · · end of aisle · · ·
          </div>
        </div>
      </div>
    </div>
  );
}
