import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from "react-router";
import { searchMovieById } from "services/tmdb";
import { SaveMovieButton } from "~/components/MovieList";
import { MoviePoster } from "~/components/MoviePoster";
import { Badge } from "~/components/ui/badge";
import { saveToDB } from "~/models/movie.server";

function formatReleaseDate(releaseDate?: string) {
  if (!releaseDate) {
    return "N/A";
  }

  const parsedDate = new Date(`${releaseDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return "N/A";
  }

  return parsedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRuntime(runtime?: number | null) {
  if (!runtime || runtime <= 0) {
    return "N/A";
  }

  const hours = Math.floor(runtime / 60);
  const minutes = runtime % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function formatRating(voteAverage?: number, voteCount?: number) {
  if (voteAverage === undefined || voteAverage === null) {
    return "N/A";
  }

  const rating = `${voteAverage.toFixed(1)}/10`;
  if (!voteCount) {
    return rating;
  }

  return `${rating} (${voteCount.toLocaleString()} votes)`;
}

function formatLanguage(languageCode?: string) {
  if (!languageCode) {
    return "N/A";
  }

  return languageCode.toUpperCase();
}

function formatPopularity(popularity?: number) {
  if (popularity === undefined || popularity === null) {
    return "N/A";
  }

  return popularity.toFixed(1);
}

function MovieDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!params.id) {
    throw new Response("Movie id is required", { status: 400 });
  }

  const movieId = String(params.id);
  const movie = await searchMovieById(movieId);

  return movie;
};

// TODO: I think there's a way to use the other action function here.
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();

  const movieTitle = body.get("movieTitle") as string;
  const movieReleaseDate = body.get("movieReleaseDate") as string;
  const imageUrl = body.get("imageUrl") as string;

  await saveToDB({ movieName: movieTitle, releaseDate: movieReleaseDate, imageUrl });
  return redirect("/movies");
};

export default function MoviePage() {
  const movie = useLoaderData<typeof loader>();
  const movieForSaving = {
    id: movie.id,
    title: movie.title,
    releaseDate: movie.release_date,
    posterPath: movie.poster_path ?? "",
  };

  return (
    <div className="mx-auto my-10 grid max-w-5xl grid-cols-1 gap-8 px-4 md:grid-cols-[320px_minmax(0,1fr)]">
      <div className="w-full max-w-[320px]">
        <MoviePoster src={movie.poster_path} alt={movie.title} className="h-auto" />
      </div>

      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{movie.title}</h2>
          {movie.tagline ? (
            <p className="text-muted-foreground italic">{movie.tagline}</p>
          ) : null}
        </div>

        {movie.genres && movie.genres.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {movie.genres.map((genre) => (
              <Badge key={genre.id} variant="secondary">
                {genre.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <p className="text-base leading-relaxed text-muted-foreground">
          {movie.overview || "No overview available for this movie."}
        </p>

        <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 sm:grid-cols-2">
          <MovieDetailItem label="Release date" value={formatReleaseDate(movie.release_date)} />
          <MovieDetailItem label="Runtime" value={formatRuntime(movie.runtime)} />
          <MovieDetailItem
            label="Rating"
            value={formatRating(movie.vote_average, movie.vote_count)}
          />
          <MovieDetailItem label="Language" value={formatLanguage(movie.original_language)} />
          <MovieDetailItem label="Status" value={movie.status || "N/A"} />
          <MovieDetailItem label="Popularity" value={formatPopularity(movie.popularity)} />
        </div>

        <div>
          <SaveMovieButton movie={movieForSaving} />
        </div>
      </div>
    </div>
  );
}
