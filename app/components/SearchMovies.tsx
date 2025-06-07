import { Form, useLocation, useNavigation } from "react-router";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";

export function SearchMovies() {
  const location = useLocation();
  const q = new URLSearchParams(location.search).get("q");
  const [query, setQuery] = useState<string>(q || "");

  const navigation = useNavigation();
  const loading = navigation.formAction === "/";

  useEffect(() => {
    setQuery(q || "");
  }, [q]);

  return (
    <div className="mx-auto w-full md:w-[300px]">
      <Form className="flex gap-3" method="GET" action="/search">
        <div className="relative w-full">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="q"
            name="q"
            type="text"
            placeholder="Search Movie"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="pl-8"
          />
        </div>
        {loading ? <Loader2 className="animate-spin" /> : null}
        <Button
          disabled={loading}
          className="sr-only"
          type="submit"
          name="_action"
          value="search"
        >
          Submit
        </Button>
      </Form>
    </div>
  );
}
