import { redirect } from "react-router";
import { z } from "zod";
import { MovieStatus } from "~/lib/status";
import {
  changeMovieStatus,
  removeMovies,
  saveToDB,
  updateMovie,
} from "~/models/movie.server";

const updateMovieSchema = z.object({
  movieName: z.string().min(1, { message: "Movie name is required" }),
  releaseDate: z.string().min(1, { message: "Release date is required" }),
  selectedBy: z.string().min(1, { message: "Selected by is required" }),
  categoryName: z.string().min(1, { message: "Category name is required" }),
});

export async function handleMovieAction(request: Request) {
  const body = await request.formData();
  const action = body.get("_action");

  if (action === "movieStatus") {
    const movieId = body.get("movieId") as string;
    const status = body.get("movieStatus") as MovieStatus;
    await changeMovieStatus({ id: movieId, status });
    return { message: "Movie status updated" };
  }

  if (action === "update") {
    const movieId = body.get("movieId") as string;
    try {
      const parseData = updateMovieSchema.parse({
        movieName: body.get("movieName"),
        releaseDate: body.get("releaseDate"),
        selectedBy: body.get("selectedBy"),
        categoryName: body.get("categoryName"),
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

  // Default path: SaveMovieButton posts without an _action field.
  const movieName = body.get("movieTitle") as string;
  const releaseDate = body.get("movieReleaseDate") as string;
  const imageUrl = (body.get("imageUrl") as string) || undefined;
  await saveToDB({ movieName, releaseDate, imageUrl });
  return redirect("/movies");
}
