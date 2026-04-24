import { Loader2 } from "lucide-react";
import {
  Form,
  href,
  Link,
  useNavigation,
} from "react-router";
import { searchMovie } from "services/tmdb";
import { handleMovieAction } from "~/actions/movie.server";
import { Button, Field, Poster } from "~/components/mv";
import { SaveMovieButton } from "~/components/SaveMovieButton";
import { requireLogin } from "~/utils/auth.server";
import type { Route } from "./+types/search";

type SearchItem = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
};

export const loader = async ({ request }: Route.LoaderArgs) => {
  await requireLogin(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const searchResults = q ? await searchMovie(q) : [];
  return { searchResults, query: q };
};

export const action = ({ request }: Route.ActionArgs) => handleMovieAction(request);

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { searchResults, query } = loaderData;
  const navigation = useNavigation();
  const searching =
    navigation.state === "loading" &&
    navigation.location?.pathname === href("/search");

  return (
    <div className="py-10">
      <div className="mb-[6px] font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        ▸ search the shelves
      </div>
      <h1 className="m-0 mb-6 font-hand-2 text-4xl text-ink">Search</h1>

      <Form method="GET" action={href("/search")} className="mb-8">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field
              id="q"
              name="q"
              type="text"
              defaultValue={query}
              placeholder="try: paris, texas"
              autoComplete="off"
              autoFocus
            />
          </div>
          <Button variant="primary" type="submit" disabled={searching}>
            {searching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Search →"
            )}
          </Button>
        </div>
      </Form>

      {query && (
        <>
          <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {searchResults.length > 0
              ? `${searchResults.length} result${searchResults.length === 1 ? "" : "s"} for "${query}"`
              : `no results for "${query}"`}
          </div>

          {searchResults.length === 0 ? (
            <div className="rounded-[6px] border-2 border-dashed border-rule p-[60px] text-center font-hand text-[16px] text-muted">
              The shelves are dusty. Try a different title.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {(searchResults as SearchItem[]).map((movie, i) => {
                const year = movie.release_date?.split("-")[0];
                return (
                  <div key={movie.id} className="flex flex-col gap-2">
                    <Link to={href("/movies/:id", { id: String(movie.id) })}>
                      <Poster
                        movie={{
                          id: String(movie.id),
                          title: movie.title,
                          year,
                          posterUrl: movie.poster_path ?? undefined,
                        }}
                        tilt={i % 2 ? 0.6 : -0.6}
                        size="md"
                      />
                    </Link>
                    <div className="font-hand-2 text-[14px] leading-tight text-ink">
                      {movie.title}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
                      {year ?? "—"}
                    </div>
                    <SaveMovieButton
                      movie={{
                        id: movie.id,
                        title: movie.title,
                        release_date: movie.release_date,
                        poster_path: movie.poster_path,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
