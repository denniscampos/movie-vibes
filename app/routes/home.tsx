import { ActionFunctionArgs, LoaderFunctionArgs, type MetaFunction } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { useState } from "react";
import { usernameCookie } from "utils/cookies";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { UpcomingMovies } from "~/components/UpcomingMovies";
import { MovieStatus } from "~/lib/status";
import {
  changeMovieStatus,
  fetchUpcomingMovies,
  removeMovies,
  saveToDB,
  updateMovie,
} from "~/models/movie.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Movie Vibes" },
    { name: "description", content: "Vibe with yo friends." },
  ];
};

const updateMovieSchema = z.object({
  movieName: z.string().min(1, { message: "Movie name is required" }),
  releaseDate: z.string().min(1, { message: "Release date is required" }),
  selectedBy: z.string().min(1, { message: "Selected by is required" }),
  categoryName: z.string().min(1, { message: "Category name is required" }),
});

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  const userVisited = (await usernameCookie.parse(cookieHeader)) || false;

  if (!userVisited) {
    return redirect("/login");
  }

  const upcomingMovies = await fetchUpcomingMovies();

  return {
    upcomingMovies,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const body = await request.formData();
  const movieId = body.get("movieId") as string;
  const movieStatus = body.get("movieStatus") as MovieStatus;

  const action = body.get("_action");

  const movieTitle = body.get("movieTitle") as string;
  const movieReleaseDate = body.get("movieReleaseDate") as string;

  if (action === "movieStatus") {
    await changeMovieStatus({ id: movieId, status: movieStatus });

    return { message: "Movie status updated" };
  }

  if (action === "create") {
    await saveToDB({ movieName: movieTitle, releaseDate: movieReleaseDate });
    return redirect("/movies");
  }

  if (action === "update") {
    const movieId = body.get("movieId") as string;
    const movieName = body.get("movieName") as string;
    const releaseDate = body.get("releaseDate") as string;
    const selectedBy = body.get("selectedBy") as string;
    const categoryName = body.get("categoryName") as string;

    try {
      const parseData = updateMovieSchema.parse({
        movieName,
        releaseDate,
        selectedBy,
        categoryName,
      });

      const updatedMovie = await updateMovie({ ...parseData, movieId });
      return { updatedMovie };
    } catch (error) {
      return { error };
    }
  }

  if (action === "destroy") {
    const movieId = body.get("movieId") as string;
    await removeMovies(movieId.split(","));
    return { success: true };
  }
};

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
