import { Loader2 } from "lucide-react";
import { Form, useNavigation } from "react-router";
import { Button } from "./mv";

type MovieInput = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
};

export function SaveMovieButton({ movie }: { movie: MovieInput }) {
  const navigation = useNavigation();
  const loading =
    navigation.state === "submitting" &&
    navigation.formMethod === "POST" &&
    navigation.formData?.get("movieTitle") === movie.title;

  return (
    <Form method="POST">
      <input type="hidden" name="tmdbId" value={movie.id} />
      <input type="hidden" name="movieTitle" value={movie.title} />
      <input type="hidden" name="movieReleaseDate" value={movie.release_date} />
      <input type="hidden" name="imageUrl" value={movie.poster_path ?? ""} />

      <Button variant="primary" size="sm" type="submit" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : "+ Save to library"}
      </Button>
    </Form>
  );
}
