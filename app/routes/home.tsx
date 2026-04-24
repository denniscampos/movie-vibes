import { useState } from "react";
import { href, Link } from "react-router";
import { handleMovieAction } from "~/actions/movie.server";
import { Button, Poster, Wheel, type WheelName } from "~/components/mv";
import { fetchUpcomingMovies } from "~/models/movie.server";
import { requireLogin } from "~/utils/auth.server";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "Movie Vibes" },
  { name: "description", content: "Vibe with yo friends." },
];

export const loader = async ({ request }: Route.LoaderArgs) => {
  await requireLogin(request);
  const upcomingMovies = await fetchUpcomingMovies();
  return { upcomingMovies };
};

export const action = ({ request }: Route.ActionArgs) => handleMovieAction(request);

export default function Home({ loaderData }: Route.ComponentProps) {
  const { upcomingMovies } = loaderData;
  const [result, setResult] = useState<WheelName | null>(null);

  const names: WheelName[] = Array.from(
    new Set(
      upcomingMovies
        .map((m) => m.selectedBy)
        .filter((n): n is string => Boolean(n && n.trim())),
    ),
  ).map((n) => ({ id: n, name: n }));

  return (
    <div className="py-12">
      <div className="text-center">
        <h1 className="m-0 mb-[6px] font-hand-2 text-[48px] tracking-[-0.01em] text-ink">
          Who&apos;s picking tonight?
        </h1>
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          spin · fate decides · no arguments
        </div>
      </div>

      <div className="my-8">
        {names.length === 0 && <EmptyWheel />}
        {names.length === 1 && <SoloCallout name={names[0].name} />}
        {names.length >= 2 && <Wheel names={names} onResult={setResult} />}
      </div>

      <DottedRule />

      <section className="mt-9">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="m-0 font-hand-2 text-2xl text-ink">Upcoming queue</h3>
          <Link
            to={href("/movies")}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:text-ink"
          >
            {upcomingMovies.length} waiting · see all →
          </Link>
        </div>
        {upcomingMovies.length === 0 ? (
          <EmptyQueue />
        ) : (
          <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-3 md:grid-cols-5">
            {upcomingMovies.map((m, i) => {
              const poster = (
                <Poster
                  movie={{
                    id: m.id,
                    title: m.movieName,
                    year: m.releaseDate,
                    posterUrl: m.imageUrl ?? undefined,
                  }}
                  tilt={i % 2 ? 0.6 : -0.4}
                  size="md"
                />
              );
              const caption = (
                <>
                  <div className="font-hand-2 text-[13px] leading-[1.1] text-ink">
                    {m.movieName}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.06em] text-muted">
                    {m.releaseDate}
                    {m.selectedBy ? ` · ${m.selectedBy}` : null}
                  </div>
                </>
              );
              return m.tmdbId != null ? (
                <Link
                  key={m.id}
                  to={href("/movies/:id", { id: String(m.tmdbId) })}
                  className="flex flex-col gap-[6px]"
                >
                  {poster}
                  {caption}
                </Link>
              ) : (
                <div key={m.id} className="flex flex-col gap-[6px] opacity-80">
                  {poster}
                  {caption}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {result && <ResultModal result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

function EmptyWheel() {
  return (
    <div className="mx-auto max-w-md rounded-[6px] border-2 border-dashed border-rule p-8 text-center font-hand text-[16px] text-muted">
      No upcoming picks yet.{" "}
      <Link to={href("/movies/new")} className="text-accent underline">
        Queue one up →
      </Link>
    </div>
  );
}

function SoloCallout({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-md rounded-[6px] border-[3px] border-accent bg-card px-8 py-10 text-center shadow-ink-lg">
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        only one on the wheel
      </div>
      <div className="my-3 font-hand-2 text-[48px] leading-none text-accent">{name}</div>
      <div className="font-hand text-[15px] text-ink-soft">
        You&apos;re up by default. No pressure.
      </div>
    </div>
  );
}

function EmptyQueue() {
  return (
    <div className="rounded-[6px] border-2 border-dashed border-rule p-8 text-center font-hand text-[16px] text-muted">
      No movies queued.{" "}
      <Link to={href("/movies/new")} className="text-accent underline">
        Add one →
      </Link>
    </div>
  );
}

function DottedRule() {
  return (
    <div
      className="mt-9 h-[10px] w-full opacity-25"
      style={{
        backgroundImage:
          "radial-gradient(circle at 5px 5px, transparent 2.5px, hsl(var(--ink-line)) 2.5px, hsl(var(--ink-line)) 3px, transparent 3px)",
        backgroundSize: "10px 10px",
      }}
    />
  );
}

function ResultModal({ result, onClose }: { result: WheelName; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-500 flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-md rounded-[6px] border-[3px] border-accent bg-paper px-14 py-10 text-center shadow-ink-lg"
      >
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          the wheel has spoken
        </div>
        <div className="my-3 font-hand-2 text-[54px] leading-none text-accent">
          {result.name}
        </div>
        <div className="mb-6 font-hand text-[17px] text-ink-soft">
          Your movie was picked.
        </div>
        <div className="flex justify-center gap-[10px]">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
