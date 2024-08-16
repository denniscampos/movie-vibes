import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { redirect, useLoaderData } from "@remix-run/react";
import { searchMovieById } from "services/tmdb";
import { SaveMovieButton } from "~/components/MovieList";
import { saveToDB } from "~/models/movie.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const movieId = String(params.id);
  const movie = await searchMovieById(movieId);

  return json(movie);
};

// TODO: I think there's a way to use the other action function here.
export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();

  const movieTitle = body.get("movieTitle") as string;
  const movieReleaseDate = body.get("movieReleaseDate") as string;

  await saveToDB({ movieName: movieTitle, releaseDate: movieReleaseDate });
  return redirect("/movies");
};

export default function MoviePage() {
  const movie = useLoaderData<typeof loader>();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto my-10">
      <div className="w-80">
        <img className="object-contain" src={movie.poster_path ?? ""} alt={movie.title} />
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">{movie.title}</h2>
        <p>{movie.overview}</p>
        {/* @ts-expect-error types are off */}
        <SaveMovieButton movie={movie} />
      </div>
    </div>
  );
}
