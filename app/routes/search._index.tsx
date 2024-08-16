import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { searchMovie } from "services/tmdb";
import { MovieList } from "~/components/MovieList";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const searchResults = await searchMovie(q);

  return json(searchResults);
};

export default function SearchPage() {
  const loaderData = useLoaderData<typeof loader>();

  return <MovieList movies={loaderData} />;
}
