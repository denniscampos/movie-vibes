import { zodResolver } from "@hookform/resolvers/zod";
import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { Form, json, useNavigation } from "@remix-run/react";
import { Loader2 } from "lucide-react";
import { FieldValues } from "react-hook-form";
import { useRemixForm, getValidatedFormData } from "remix-hook-form";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { MovieStatus } from "~/lib/status";
import { createMovie } from "~/models/movie.server";

const createMovieSchema = z.object({
  movieName: z.string().min(1, { message: "Movie name is required" }),
  releaseDate: z.string().min(1, { message: "Release date is required" }),
  selectedBy: z.string().min(1, { message: "Selected by is required" }),
  categoryName: z.string().min(1, { message: "Category name is required" }),
  status: z.nativeEnum(MovieStatus),
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

  const { movieName, categoryName, releaseDate, selectedBy, status } = data;

  await createMovie({
    movieName,
    releaseDate,
    selectedBy,
    categoryName,
    status,
  });

  return redirect(`/movies`);
};

export default function MoviesCreatePage() {
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useRemixForm<MovieSchema>({
    mode: "onSubmit",
    resolver,
    defaultValues: {
      movieName: "",
      releaseDate: "",
      selectedBy: "",
      categoryName: "",
      status: MovieStatus.NOT_WATCHED,
    },
  });

  return (
    <div className="py-10">
      <Card className="w-[350px] mx-auto">
        <CardHeader>
          <CardTitle>Add a Movie</CardTitle>
          <CardDescription>
            Add a movie to keep track of our movie watching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="POST" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="movieName">Movie Name</Label>
              <Input
                {...register("movieName")}
                id="movieName"
                name="movieName"
                type="text"
              />
              <p className="text-red-500">
                {errors.movieName && errors.movieName.message}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="releaseDate">Release Date</Label>
              <Input
                {...register("releaseDate")}
                id="releaseDate"
                name="releaseDate"
                type="text"
              />
              <p className="text-red-500">
                {errors.releaseDate && errors.releaseDate.message}
              </p>
            </div>

            <div className="space-y-2">
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
              <p className="text-red-500">
                {errors.selectedBy && errors.selectedBy.message}
              </p>
            </div>

            <div>
              <SelectMovieStatus setValue={setValue} />
              <p className="text-red-500">{errors.status && errors.status.message}</p>
            </div>

            <Button className="mt-2" type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : "Add Movie"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

function SelectMovieStatus({ setValue }: { setValue: FieldValues["setValue"] }) {
  return (
    <Select onValueChange={(value) => setValue("status", value)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Movie Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="NOT_WATCHED">Not Watched</SelectItem>
        <SelectItem value="UPCOMING">Upcoming</SelectItem>
        <SelectItem value="WATCHED">Watched</SelectItem>
      </SelectContent>
    </Select>
  );
}
