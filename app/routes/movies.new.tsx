import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
  Form,
  useNavigation,
} from "react-router";
import { Loader2 } from "lucide-react";
import { FieldValues } from "react-hook-form";
import { useRemixForm, getValidatedFormData } from "remix-hook-form";
import { usernameCookie } from "utils/cookies";
import { z } from "zod";
import { Button } from "~/components/ui/button";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  const userVisited = (await usernameCookie.parse(cookieHeader)) || false;

  if (!userVisited) {
    return redirect("/login");
  }

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { receivedValues, errors, data } = await getValidatedFormData<MovieSchema>(
    request,
    resolver
  );

  if (errors) {
    return { errors, receivedValues };
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
    <div className="container mx-auto px-4 min-h-screen flex items-start bg-transparent py-16">
      <div className="w-full px-4">
        <h1 className="text-2xl sm:text-4xl font-bold mb-10">Add New Movie</h1>
        <Form method="POST" onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="movieName" className="text-base">
              Movie Name
            </Label>
            <Input
              {...register("movieName")}
              id="movieName"
              name="movieName"
              type="text"
              placeholder="Enter movie name"
              className="h-12 text-base"
            />
            <p className="text-red-500 text-sm">
              {errors.movieName && errors.movieName.message}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="releaseDate" className="text-base">
              Release Date (YYYY)
            </Label>
            <Input
              {...register("releaseDate")}
              id="releaseDate"
              name="releaseDate"
              type="text"
              placeholder="2010"
              className="h-12 text-base"
            />
            <p className="text-red-500 text-sm">
              {errors.releaseDate && errors.releaseDate.message}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryName" className="text-base">
              Category
            </Label>
            <Input
              {...register("categoryName")}
              id="categoryName"
              name="categoryName"
              type="text"
              placeholder="Enter category"
              className="h-12 text-base"
            />
            <p className="text-red-500 text-sm">
              {errors.categoryName && errors.categoryName.message}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="selectedBy" className="text-base">
              Selected By
            </Label>
            <Input
              {...register("selectedBy")}
              id="selectedBy"
              name="selectedBy"
              type="text"
              placeholder="Enter name"
              className="h-12 text-base"
            />
            <p className="text-red-500 text-sm">
              {errors.selectedBy && errors.selectedBy.message}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-base">Movie Status</Label>
            <SelectMovieStatus setValue={setValue} />
            <p className="text-red-500 text-sm">
              {errors.status && errors.status.message}
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              className="mt-4 h-12 text-base font-semibold px-8"
              type="submit"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : "Add Movie"}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}

function SelectMovieStatus({ setValue }: { setValue: FieldValues["setValue"] }) {
  return (
    <Select onValueChange={(value) => setValue("status", value)}>
      <SelectTrigger className="h-12 text-base">
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
