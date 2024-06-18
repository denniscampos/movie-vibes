import { Form, useNavigation } from "@remix-run/react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Loader2 } from "lucide-react";

export function SearchMovies() {
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  return (
    <div className="mx-auto w-[500px] mb-5">
      <Form className="flex gap-3" method="POST">
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
      </Form>
    </div>
  );
}
