import { href, Link } from "react-router";
import { searchMovieById } from "services/tmdb";
import { handleMovieAction } from "~/actions/movie.server";
import { SaveMovieButton } from "~/components/SaveMovieButton";
import { Chip, Poster } from "~/components/mv";
import type { Route } from "./+types/movie";

export const loader = async ({ params }: Route.LoaderArgs) => {
  const movieId = String(params.id);
  const movie = await searchMovieById(movieId);
  return movie;
};

export const action = ({ request }: Route.ActionArgs) => handleMovieAction(request);

function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function MoviePage({ loaderData: movie }: Route.ComponentProps) {
  const year = movie.release_date?.split("-")[0];
  const runtime = formatRuntime(movie.runtime);
  const primaryGenre = movie.genres[0]?.name ?? null;

  const metaBits = [year, runtime, primaryGenre, movie.director].filter(
    (s): s is string => Boolean(s),
  );

  return (
    <div className="py-10">
      <Link
        to={href("/browse")}
        className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-ink"
      >
        ← back to browse
      </Link>

      <div className="mt-5 grid gap-8 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-start gap-3">
          <Poster
            movie={{
              id: String(movie.id),
              title: movie.title,
              year,
              posterUrl: movie.poster_path ?? undefined,
            }}
            size="xl"
          />
          <SaveMovieButton
            movie={{
              id: movie.id,
              title: movie.title,
              release_date: movie.release_date,
              poster_path: movie.poster_path,
            }}
          />
        </div>

        <div>
          <h1 className="m-0 mb-1 font-hand-2 text-[40px] leading-tight text-ink">
            {movie.title}
          </h1>
          {movie.tagline && (
            <div className="mb-2 font-hand text-[15px] italic text-ink-soft">
              &ldquo;{movie.tagline}&rdquo;
            </div>
          )}
          <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
            {metaBits.length > 0 ? metaBits.join(" · ") : "—"}
          </div>
          <p className="mb-5 font-hand text-[16px] leading-[1.5] text-ink-soft">
            {movie.overview || "No overview available."}
          </p>

          {movie.genres.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {movie.genres.map((g) => (
                <Chip key={g.id}>{g.name}</Chip>
              ))}
            </div>
          )}

          <CommunityRating average={movie.vote_average} count={movie.vote_count} />
        </div>
      </div>
    </div>
  );
}

function CommunityRating({ average, count }: { average: number; count: number }) {
  if (count === 0) {
    return null;
  }
  return (
    <div className="rounded-organic-sm border-2 border-ink-line bg-card p-4">
      <div className="mb-[6px] font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        TMDB community rating
      </div>
      <div className="flex items-baseline gap-3">
        <div className="font-hand-2 text-[32px] leading-none text-ink">
          {average.toFixed(1)}
          <span className="text-[16px] text-muted">/10</span>
        </div>
        <div className="font-hand text-[13px] text-ink-soft">
          {count.toLocaleString()} {count === 1 ? "vote" : "votes"}
        </div>
      </div>
    </div>
  );
}
