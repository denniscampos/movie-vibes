import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Form,
  href,
  Link,
  redirect,
  useFetcher,
  useNavigation,
} from "react-router";
import { getValidatedFormData, useRemixForm } from "remix-hook-form";
import { searchMovie } from "services/tmdb";
import { z } from "zod";
import { Button, Field, Poster, Select } from "~/components/mv";
import { cn } from "~/lib/utils";
import { MovieStatus } from "~/lib/status";
import { createMovie } from "~/models/movie.server";
import { requireLogin } from "~/utils/auth.server";
import type { Route } from "./+types/new";

type SearchResult = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
};

const createMovieSchema = z.object({
  movieName: z.string().min(1, { message: "Movie name is required" }),
  releaseDate: z.string().min(1, { message: "Release year is required" }),
  selectedBy: z.string().min(1, { message: "Picker is required" }),
  categoryName: z.string().min(1, { message: "Category is required" }),
  status: z.nativeEnum(MovieStatus),
  imageUrl: z.string().optional(),
  tmdbId: z.string().optional(),
});

type MovieSchema = z.infer<typeof createMovieSchema>;
const resolver = zodResolver(createMovieSchema);

export const loader = async ({ request }: Route.LoaderArgs) => {
  await requireLogin(request);

  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("q");

  if (searchQuery) {
    const searchResults = await searchMovie(searchQuery);
    return { searchResults };
  }
  return { searchResults: [] as SearchResult[] };
};

export const action = async ({ request }: Route.ActionArgs) => {
  await requireLogin(request);
  const { receivedValues, errors, data } = await getValidatedFormData<MovieSchema>(
    request,
    resolver,
  );

  if (errors) {
    return { errors, receivedValues };
  }

  const {
    movieName,
    categoryName,
    releaseDate,
    selectedBy,
    status,
    imageUrl,
    tmdbId,
  } = data;

  await createMovie({
    movieName,
    releaseDate,
    selectedBy,
    categoryName,
    status,
    imageUrl,
    tmdbId: tmdbId ? Number(tmdbId) : undefined,
  });

  return redirect(href("/movies"));
};

export default function MoviesCreatePage() {
  const navigation = useNavigation();
  const submitting = navigation.state !== "idle";

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchFetcher = useFetcher<{ searchResults: SearchResult[] }>();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useRemixForm<MovieSchema>({
    mode: "onSubmit",
    resolver,
    defaultValues: {
      movieName: "",
      releaseDate: "",
      selectedBy: "",
      categoryName: "",
      imageUrl: "",
      status: MovieStatus.NOT_WATCHED,
    },
  });

  const movieName = watch("movieName");

  // Debounced TMDB search. Skips when the typed name matches the last-picked
  // suggestion so the dropdown doesn't re-open after a selection.
  useEffect(() => {
    if (!movieName || movieName.length <= 2) {
      setSearchResults([]);
      return;
    }
    if (selectedMovie && selectedMovie.title === movieName) {
      return;
    }
    const handler = window.setTimeout(() => {
      setIsSearching(true);
      searchFetcher.submit(
        { q: movieName },
        { method: "get", action: href("/movies/new") },
      );
    }, 500);
    return () => window.clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieName, selectedMovie]);

  useEffect(() => {
    if (searchFetcher.data?.searchResults) {
      setSearchResults(searchFetcher.data.searchResults);
      setIsSearching(false);
    }
  }, [searchFetcher.data]);

  const handleMovieSelect = (movie: SearchResult) => {
    const year = movie.release_date?.split("-")[0] ?? "";
    setValue("movieName", movie.title);
    setValue("releaseDate", year);
    setValue("imageUrl", movie.poster_path ?? "");
    setValue("tmdbId", String(movie.id));
    setSelectedMovie(movie);
    setSearchResults([]);
  };

  const showSuggestions =
    searchResults.length > 0 &&
    !(selectedMovie && selectedMovie.title === movieName);

  return (
    <div className="py-10">
      <div className="mb-[6px] font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        step 1 of 1 · any vibe welcome
      </div>
      <h1 className="m-0 mb-6 font-hand-2 text-4xl text-ink">Add a movie</h1>

      <Form method="POST" onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-[1fr_180px]">
          <div className="flex flex-col gap-4">
            <input type="hidden" {...register("imageUrl")} />
            <input type="hidden" {...register("tmdbId")} />

            <div className="relative">
              <Field
                {...register("movieName")}
                label="Movie name"
                placeholder="type a movie title..."
                autoComplete="off"
                error={errors.movieName?.message}
              />
              {isSearching && (
                <div className="pointer-events-none absolute right-[14px] top-[32px]">
                  <Loader2 className="size-4 animate-spin text-muted" />
                </div>
              )}
              {showSuggestions && (
                <div className="absolute z-10 mt-[6px] w-full overflow-hidden rounded-[4px] border-2 border-ink-line bg-card">
                  {searchResults.map((movie, i) => (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => handleMovieSelect(movie)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-paper",
                        i < searchResults.length - 1 &&
                          "border-b border-dashed border-rule",
                      )}
                    >
                      {movie.poster_path ? (
                        <img
                          src={movie.poster_path}
                          alt=""
                          className="h-[42px] w-[28px] flex-none object-cover"
                        />
                      ) : (
                        <div className="h-[42px] w-[28px] flex-none border border-dashed border-rule bg-paper-2" />
                      )}
                      <div>
                        <div className="font-hand-2 text-[14px] leading-tight text-ink">
                          {movie.title}
                        </div>
                        <div className="font-mono text-[10px] text-muted">
                          ({movie.release_date?.split("-")[0] ?? "—"})
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Field
              {...register("releaseDate")}
              label="Release year"
              placeholder="2010"
              error={errors.releaseDate?.message}
            />

            <Field
              {...register("selectedBy")}
              label="Who's picking?"
              placeholder="enter a name"
              error={errors.selectedBy?.message}
            />

            <Field
              {...register("categoryName")}
              label="Category"
              placeholder="enter a category"
              error={errors.categoryName?.message}
            />

            <Select
              {...register("status")}
              label="Status"
              options={[
                { value: MovieStatus.UPCOMING, label: "Upcoming" },
                { value: MovieStatus.WATCHED, label: "Watched" },
                { value: MovieStatus.NOT_WATCHED, label: "Not watched" },
              ]}
              error={errors.status?.message}
            />

            <div className="mt-3 flex justify-end gap-[10px]">
              <Link to={href("/")}>
                <Button type="button">Cancel</Button>
              </Link>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Add movie →"
                )}
              </Button>
            </div>
          </div>

          <div>
            {selectedMovie ? (
              <div className="flex flex-col gap-2">
                <Poster
                  movie={{
                    id: String(selectedMovie.id),
                    title: selectedMovie.title,
                    year: selectedMovie.release_date?.split("-")[0],
                    posterUrl: selectedMovie.poster_path ?? undefined,
                  }}
                  size="md"
                />
                <div className="font-hand-2 text-[14px] leading-tight text-ink">
                  {selectedMovie.title}
                </div>
                <div className="font-mono text-[10px] text-muted">
                  {selectedMovie.release_date?.split("-")[0] ?? "—"}
                </div>
              </div>
            ) : (
              <div className="flex aspect-[2/3] w-[140px] items-center justify-center rounded-[4px] border-2 border-dashed border-rule p-[10px] text-center font-mono text-[10px] uppercase leading-[1.4] tracking-[0.1em] text-muted">
                poster
                <br />
                preview
              </div>
            )}
          </div>
        </div>
      </Form>
    </div>
  );
}
