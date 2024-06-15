import { zodResolver } from "@hookform/resolvers/zod";
import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { Form, json, useNavigation } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { useRemixForm, getValidatedFormData } from "remix-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createMovie } from "~/models/movie.server";

const createMovieSchema = z.object({
  movieName: z.string().min(1, { message: "Movie name is required" }),
  releaseDate: z.string().min(1, { message: "Release date is required" }),
  selectedBy: z.string().min(1, { message: "Selected by is required" }),
  categoryName: z.string().min(1, { message: "Category name is required" }),
});

type MovieSchema = z.infer<typeof createMovieSchema>;
const resolver = zodResolver(createMovieSchema);

export const action = async ({ request }: ActionFunctionArgs) => {
  const { receivedValues, errors, data } = await getValidatedFormData<MovieSchema>(
    request,
    resolver
  );

  if (errors) {
    return json({ errors, receivedValues });
  }

  const { movieName, categoryName, releaseDate, selectedBy } = data;

  await createMovie({
    movieName,
    releaseDate,
    selectedBy,
    categoryName,
  });

  return redirect(`/`);
};

export default function MoviesCreatePage() {
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useRemixForm<MovieSchema>({
    mode: "onSubmit",
    resolver,
    defaultValues: {
      movieName: "",
      releaseDate: "",
      selectedBy: "",
      categoryName: "",
    },
  });

  return (
    <div>
      <h2>Movies</h2>

      <Form method="POST" onSubmit={handleSubmit}>
        <Label htmlFor="movieName">Movie Name</Label>
        <Input {...register("movieName")} id="movieName" name="movieName" type="text" />
        <p className="text-red-500">{errors.movieName && errors.movieName.message}</p>

        <Label htmlFor="releaseDate">Release Date</Label>
        <Input
          {...register("releaseDate")}
          id="releaseDate"
          name="releaseDate"
          type="text"
        />
        <p className="text-red-500">{errors.releaseDate && errors.releaseDate.message}</p>

        <Label htmlFor="categoryName">Category</Label>
        <Input
          {...register("categoryName")}
          id="categoryName"
          name="categoryName"
          type="text"
        />
        <p className="text-red-500">
          {errors.categoryName && errors.categoryName.message}
        </p>

        <Label htmlFor="selectedBy">Selected By</Label>
        <Input
          {...register("selectedBy")}
          id="selectedBy"
          name="selectedBy"
          type="text"
        />
        <p className="text-red-500">{errors.selectedBy && errors.selectedBy.message}</p>

        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : "Submit"}
        </Button>
      </Form>
    </div>
  );
}
