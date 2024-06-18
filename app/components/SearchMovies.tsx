import { useFetcher } from "@remix-run/react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";

export function SearchMovies() {
  const fetcher = useFetcher();
  const loading = fetcher.state !== "idle";

  return (
    <div className="mx-auto w-[500px] mb-5">
      <fetcher.Form className="flex gap-3" method="POST">
        <Input
          // id="searchMovies"
          name="searchMovies"
          type="text"
          placeholder="Search Movie"
        />
        {loading ? <Loader2 className="animate-spin" /> : null}
        <Button className="sr-only" type="submit" name="_action" value="search">
          Submit
        </Button>
      </fetcher.Form>
    </div>
  );
}
