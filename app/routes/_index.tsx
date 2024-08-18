import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  type MetaFunction,
} from "@remix-run/node";
import { redirect, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { usernameCookie } from "utils/cookies";
import { z } from "zod";
import { columns } from "~/components/Columns";
import { DataTable } from "~/components/DataTable";
import { Button } from "~/components/ui/button";
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

  return json(upcomingMovies);
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

    return json({ message: "Movie status updated" });
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
      return json({ updatedMovie });
    } catch (error) {
      return json({ error });
    }
  }

  if (action === "destroy") {
    const movieId = body.get("movieId") as string;
    await removeMovies(movieId.split(","));
    return json({ success: true });
  }
};

export default function Index() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <div className="py-10">
      <h2 className="text-3xl font-semibold">Upcoming Movies</h2>
      <DataTable columns={columns} data={loaderData} />
      <NameSpinner />
    </div>
  );
}

export function NameSpinner() {
  const loaderData = useLoaderData<typeof loader>();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const selectedBy = loaderData.map((movie) => movie.selectedBy);

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
    <div className="mt-10">
      <h3 className="text-2xl font-semibold mb-2">WHOSE MOVIE ARE WE PICKING?</h3>
      <Button onClick={spin}>Spin Picker</Button>

      <div className="mt-10 flex justify-center items-center">
        {isSpinning && (
          <div className="spinner-border animate-spin inline-block w-16 h-16 border-4 rounded-full border-t-blue-500 border-r-transparent border-b-transparent border-l-blue-500">
            <span className="sr-only">Loading...</span>
          </div>
        )}

        {!isSpinning && selectedItem && (
          <div className="text-2xl font-bold text-green-600">
            Selected: {selectedItem}
          </div>
        )}
      </div>
    </div>
  );
}
