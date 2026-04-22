import { ActionFunctionArgs, LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router";
import { useState } from "react";
import { requireLogin } from "~/utils/auth.server";
import { Button } from "~/components/ui/button";
import { UpcomingMovies } from "~/components/UpcomingMovies";
import { handleMovieAction } from "~/actions/movie.server";
import { fetchUpcomingMovies } from "~/models/movie.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Movie Vibes" },
    { name: "description", content: "Vibe with yo friends." },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireLogin(request);

  const upcomingMovies = await fetchUpcomingMovies();

  return {
    upcomingMovies,
  };
};

export const action = ({ request }: ActionFunctionArgs) => handleMovieAction(request);

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <div className="py-10 overflow-x-hidden">
      <UpcomingMovies movies={loaderData.upcomingMovies} />
      <div className="container mx-auto px-4 py-8 bg-muted/50 rounded-lg my-8">
        <NameSpinner />
      </div>
    </div>
  );
}

export function NameSpinner() {
  const loaderData = useLoaderData<typeof loader>();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const selectedBy = loaderData.upcomingMovies.map((movie) => movie.selectedBy);

  const spin = () => {
    if (!selectedBy.length) return;
    setIsSpinning(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * selectedBy.length);
      setSelectedItem(selectedBy[randomIndex]);
      setIsSpinning(false);
    }, 3000);
  };

  return (
    <div className="text-center">
      <h3 className="text-3xl font-bold mb-6">WHO&apos;S UP NEXT FOR MOVIE NIGHT?</h3>
      <Button onClick={spin} size="lg" className="mb-8" disabled={!selectedBy.length}>
        Spin the Wheel
      </Button>

      <div className="min-h-[100px] flex justify-center items-center">
        {isSpinning && (
          <div className="spinner-border animate-spin inline-block w-16 h-16 border-4 rounded-full border-t-blue-500 border-r-transparent border-b-transparent border-l-blue-500">
            <span className="sr-only">Loading...</span>
          </div>
        )}

        {!isSpinning && selectedItem && (
          <div className="text-3xl font-bold text-primary animate-fade-in">
            {selectedItem} is picking next!
          </div>
        )}
      </div>
    </div>
  );
}
