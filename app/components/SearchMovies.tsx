import { Form, useLocation, useNavigation } from "@remix-run/react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";
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
    <div className="mx-auto w-full md:w-[500px]">
      <Form className="flex gap-3" method="GET" action="/search">
        <Input
          id="q"
          name="q"
          type="text"
          placeholder="Search Movie"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
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
