import { ActionFunctionArgs, LoaderFunctionArgs, useLoaderData } from "react-router";
import { searchMovieById } from "services/tmdb";
import { SaveMovieButton } from "~/components/MovieList";
import { handleMovieAction } from "~/actions/movie.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const movieId = String(params.id);
  const movie = await searchMovieById(movieId);

  return movie;
};

export const action = ({ request }: ActionFunctionArgs) => handleMovieAction(request);

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
        <SaveMovieButton movie={movie} />
      </div>
    </div>
  );
}
